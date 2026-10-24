import express from 'express';
import { Conversation } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/conversations
 * Lists all conversations for the authenticated user, sorted by lastActivityAt descending.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const conversations = await Conversation.find(
      { userId: req.user.id },
      { messages: { $slice: -1 } } // Project only the latest message for summary
    )
      .sort({ lastActivityAt: -1 })
      .limit(50);

    const summaries = conversations.map((conv) => ({
      id: conv._id,
      title: conv.title,
      mode: conv.mode,
      language: conv.language,
      lastActivityAt: conv.lastActivityAt,
      createdAt: conv.createdAt,
      lastMessage: conv.messages?.[0] || null,
    }));

    return res.json({ conversations: summaries });
  })
);

/**
 * POST /api/conversations
 * Initializes a new conversation session for the authenticated user.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { title, mode, language, initialMessage } = req.body;

    const messages = [];
    if (initialMessage && initialMessage.content) {
      messages.push({
        id: initialMessage.id || undefined,
        role: initialMessage.role || 'user',
        content: String(initialMessage.content).trim(),
        mode: initialMessage.mode || mode || 'text',
        language: initialMessage.language || language || 'en',
        timestamp: initialMessage.timestamp || new Date(),
      });
    }

    const conversation = await Conversation.create({
      userId: req.user.id,
      title: title?.trim() || (initialMessage?.content ? initialMessage.content.slice(0, 45) : 'New Conversation'),
      mode: mode || 'mixed',
      language: language || 'en',
      messages,
      lastActivityAt: new Date(),
    });

    return res.status(201).json({ conversation });
  })
);

/**
 * GET /api/conversations/:id
 * Fetches a single conversation with its complete message history.
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    return res.json({ conversation });
  })
);

/**
 * POST /api/conversations/:id/messages
 * Appends one or more finalized messages to an existing conversation.
 * Deduplicates messages by message ID to prevent double-saving.
 */
router.post(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const incomingMessages = Array.isArray(req.body.messages)
      ? req.body.messages
      : [req.body];

    const existingIds = new Set(conversation.messages.map((m) => m.id));
    const addedMessages = [];

    for (const msg of incomingMessages) {
      if (!msg || !msg.content || !String(msg.content).trim()) continue;

      const messageId = msg.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      // Deduplicate: avoid appending if an identical message ID already exists
      if (existingIds.has(messageId)) continue;

      const newMsg = {
        id: messageId,
        role: ['user', 'assistant', 'system', 'tool'].includes(msg.role) ? msg.role : 'user',
        content: String(msg.content).trim(),
        mode: msg.mode === 'voice' ? 'voice' : 'text',
        language: msg.language || conversation.language || 'en',
        status: 'sent',
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      };

      conversation.messages.push(newMsg);
      existingIds.add(messageId);
      addedMessages.push(newMsg);
    }

    conversation.lastActivityAt = new Date();

    // Auto-title conversation from first user query if still defaulted
    if (
      conversation.title === 'New Conversation' &&
      conversation.messages.length > 0
    ) {
      const firstUserMsg = conversation.messages.find((m) => m.role === 'user');
      if (firstUserMsg && firstUserMsg.content) {
        conversation.title = firstUserMsg.content.slice(0, 50).trim();
      }
    }

    await conversation.save();

    return res.status(200).json({
      success: true,
      addedCount: addedMessages.length,
      conversation,
    });
  })
);

/**
 * PATCH /api/conversations/:id
 * Updates conversation metadata (title, language, mode).
 */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const updates = {};
    if (typeof req.body.title === 'string' && req.body.title.trim()) {
      updates.title = req.body.title.trim().slice(0, 120);
    }
    if (['en', 'kn', 'hi', 'auto'].includes(req.body.language)) {
      updates.language = req.body.language;
    }
    if (['text', 'voice', 'mixed'].includes(req.body.mode)) {
      updates.mode = req.body.mode;
    }

    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: updates },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    return res.json({ conversation });
  })
);

/**
 * DELETE /api/conversations/:id
 * Deletes a conversation and its messages.
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await Conversation.deleteOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!result.deletedCount) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    return res.json({ ok: true });
  })
);

export default router;
