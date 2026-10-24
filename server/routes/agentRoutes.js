import express from 'express';
import jwt from 'jsonwebtoken';
import { User, Task } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  executeVoiceTool,
  getTodayTasks,
  getRoutineStatus,
  getProductivitySummary,
} from '../services/voiceToolsService.js';
import { getLocalDate } from '../services/routineService.js';

const router = express.Router();

/**
 * GET /api/agent/context
 * Returns personalized context and productivity overview for initializing the voice assistant.
 * Generates a short-lived transient session token so server-side Vapi tools can authenticate securely.
 */
router.get(
  '/context',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    const timezone = user?.timezone || 'UTC';
    const today = getLocalDate(timezone);

    const [todayTasks, routineStatus, productivity] = await Promise.all([
      getTodayTasks(user._id),
      getRoutineStatus(user._id),
      getProductivitySummary(user._id),
    ]);

    // Issue a short-lived 30-minute signed token specifically for Vapi tool-calling
    const sessionToken = jwt.sign(
      { id: user._id, type: 'vapi-voice-session' },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );

    return res.json({
      userName: user.name,
      timezone,
      today,
      todayTasksCount: todayTasks.count,
      activeTasksCount: productivity.activeTasksCount,
      overdueTasksCount: productivity.overdueCount,
      routinePercent: routineStatus.routinePercent,
      currentStreak: routineStatus.currentStreak,
      sessionToken,
    });
  })
);

/**
 * POST /api/agent/tools/execute
 * Direct, authenticated tool execution endpoint invoked by the client SDK when Vapi emits a tool call.
 */
router.post(
  '/tools/execute',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { toolName, args } = req.body;

    if (!toolName) {
      return res.status(400).json({ error: 'toolName is required.' });
    }

    try {
      const result = await executeVoiceTool(req.user.id, toolName, args || {});
      return res.json({ success: true, toolName, result });
    } catch (err) {
      console.error(`Error executing voice tool "${toolName}":`, err.message);
      return res.status(400).json({ success: false, error: err.message });
    }
  })
);

/**
 * POST /api/agent/vapi-webhook
 * Server-to-server webhook endpoint for Vapi Server Tools.
 * Authenticates via query parameter token, authorization header, or payload variableValues.
 */
router.post(
  '/vapi-webhook',
  asyncHandler(async (req, res) => {
    // 1. Extract and verify session token
    const token =
      req.query.token ||
      req.headers['x-vapi-token'] ||
      req.body?.message?.call?.assistantOverrides?.variableValues?.userSessionToken ||
      req.body?.call?.assistantOverrides?.variableValues?.userSessionToken;

    let targetUserId = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        targetUserId = decoded.id;
      } catch (err) {
        console.error('Invalid token in Vapi webhook:', err.message);
      }
    }

    if (!targetUserId) {
      return res.status(401).json({
        error: 'Unauthorized: Missing or invalid user session token in Vapi webhook.',
      });
    }

    // 2. Identify tool call from Vapi webhook body format
    const message = req.body.message || req.body;
    const toolCall = message.toolCall || message.toolCalls?.[0] || message.functionCall;

    if (!toolCall) {
      // General status update or ping
      return res.json({ ok: true });
    }

    const toolName = toolCall.name || toolCall.function?.name;
    let toolArgs = toolCall.parameters || toolCall.function?.arguments || {};
    if (typeof toolArgs === 'string') {
      try {
        toolArgs = JSON.parse(toolArgs);
      } catch {
        toolArgs = {};
      }
    }

    try {
      const result = await executeVoiceTool(targetUserId, toolName, toolArgs);
      return res.json({
        results: [
          {
            toolCallId: toolCall.id,
            result: JSON.stringify(result),
          },
        ],
      });
    } catch (err) {
      console.error(`Vapi webhook tool execution failed for "${toolName}":`, err.message);
      return res.json({
        results: [
          {
            toolCallId: toolCall.id,
            error: err.message,
          },
        ],
      });
    }
  })
);

/**
 * POST /api/agent/command
 * Processes natural language requests via Google Gemini API (preserved for existing text assistant).
 */
router.post(
  '/command',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const message = String(req.body.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'Enter a request.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: 'AI assistant is not configured. Add GEMINI_API_KEY on the server to enable it.',
      });
    }

    const model = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite')
      .trim()
      .replace(/^models\//, '');

    let response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY,
          },
          signal: AbortSignal.timeout(25000), // 25-second timeout
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: 'You are TaskPilot AI. Respond only JSON with keys action,data,message. Actions: create_task {title,description,priority,dueDate,estimatedMinutes}, list_tasks {status}, plan_day {}. Never claim an operation not represented by your action. For unclear requests use action=clarify and ask in message.',
                },
              ],
            },
            contents: [{ role: 'user', parts: [{ text: message }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              maxOutputTokens: 256,
            },
          }),
        }
      );
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        return res.status(504).json({ error: 'Gemini took too long to respond. Please try again.' });
      }
      console.error('Gemini network request failed:', error.message);
      return res.status(502).json({
        error: 'Could not connect to the Gemini API. Check your internet connection and try again.',
      });
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      console.error(
        'Gemini API request failed for model',
        model + ':',
        response.status,
        errorBody?.error?.message || 'No error details returned.'
      );
      return res.status(502).json({
        error: 'The AI service could not process your request. Check the Gemini API key and model configuration.',
      });
    }

    const completion = await response.json();
    const content = completion.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('');

    let parsed;
    try {
      parsed = JSON.parse(content || '');
    } catch {
      return res.status(502).json({
        error: 'The AI returned an invalid response. Please try again.',
      });
    }

    let result = null;

    if (parsed.action === 'create_task') {
      const data = parsed.data || {};
      const validPriorities = ['urgent', 'high', 'medium', 'low'];
      if (
        typeof data.title !== 'string' ||
        !data.title.trim() ||
        !validPriorities.includes(data.priority || 'medium')
      ) {
        return res.status(422).json({ error: 'The AI returned incomplete task details.' });
      }

      result = await Task.create({
        userId: req.user.id,
        title: data.title.trim(),
        description: typeof data.description === 'string' ? data.description : '',
        priority: data.priority || 'medium',
        dueDate: data.dueDate || null,
        estimatedMinutes: data.estimatedMinutes || null,
        source: 'ai',
      });
    } else if (parsed.action === 'list_tasks') {
      const validStatuses = ['todo', 'in_progress', 'completed'];
      const status = validStatuses.includes(parsed.data?.status) ? parsed.data.status : null;

      result = await Task.find({
        userId: req.user.id,
        ...(status ? { status } : {}),
      })
        .sort({ dueDate: 1 })
        .limit(30);
    } else if (parsed.action === 'plan_day') {
      result = await Task.find({
        userId: req.user.id,
        status: { $ne: 'completed' },
      })
        .sort({ dueDate: 1 })
        .limit(20);
    } else if (parsed.action !== 'clarify') {
      return res.status(422).json({ error: 'This AI action is not supported.' });
    }

    return res.json({
      action: parsed.action,
      message: parsed.message || 'Done.',
      result,
    });
  })
);

export default router;
