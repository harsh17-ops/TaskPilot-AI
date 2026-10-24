import Vapi from '@vapi-ai/web';

/**
 * Vapi Voice Assistant Service
 * 
 * Manages the Vapi Web SDK lifecycle:
 * - Singleton instance management
 * - Multilingual speech recognition & synthesis configuration
 * - Full tool definitions & prompt overrides for TaskPilot productivity actions
 * - Robust fallback and clean teardown on unmount
 */

let vapiInstance = null;

export const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY || '';
export const VAPI_ASSISTANT_ID = import.meta.env.VITE_VAPI_ASSISTANT_ID || '';

/**
 * Checks whether valid Vapi credentials have been supplied.
 */
export function isVapiConfigured() {
  return Boolean(
    VAPI_PUBLIC_KEY &&
    VAPI_PUBLIC_KEY.trim() &&
    !VAPI_PUBLIC_KEY.includes('your_vapi_public_key')
  );
}

/**
 * Retrieves or creates the singleton Vapi Web SDK instance.
 */
export function getVapi() {
  if (!isVapiConfigured()) {
    return null;
  }
  if (!vapiInstance) {
    vapiInstance = new Vapi(VAPI_PUBLIC_KEY.trim());
  }
  return vapiInstance;
}

/**
 * Complete list of tool schemas for TaskPilot productivity management.
 */
export const TASKPILOT_VOICE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task in TaskPilot with a title, priority, due date, and duration. Call this whenever the user asks to add, schedule, or create a task.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Title or short summary of the task to create (e.g. "Review quarterly slides", "Doctor appointment")',
          },
          priority: {
            type: 'string',
            enum: ['urgent', 'high', 'medium', 'low'],
            description: 'Priority level of the task. Defaults to "medium".',
          },
          dueDate: {
            type: 'string',
            description: 'Due date in YYYY-MM-DD format (e.g. 2026-10-25), or relative expression like today, tomorrow.',
          },
          estimatedMinutes: {
            type: 'number',
            description: 'Estimated minutes to complete the task.',
          },
          description: {
            type: 'string',
            description: 'Optional additional details or notes.',
          },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_task',
      description: 'Mark a task as completed in TaskPilot. Call this whenever the user says they finished a task or asks to mark it done.',
      parameters: {
        type: 'object',
        properties: {
          titleQuery: {
            type: 'string',
            description: 'Title, keyword, or name of the task to mark as completed.',
          },
          taskId: {
            type: 'string',
            description: 'Optional task ID if known.',
          },
        },
        required: ['titleQuery'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Reschedule, rename, or change the priority of an existing task in TaskPilot.',
      parameters: {
        type: 'object',
        properties: {
          titleQuery: {
            type: 'string',
            description: 'Keywords or title of the task to update.',
          },
          taskId: {
            type: 'string',
            description: 'Optional task ID.',
          },
          newTitle: {
            type: 'string',
            description: 'New title for the task.',
          },
          newPriority: {
            type: 'string',
            enum: ['urgent', 'high', 'medium', 'low'],
            description: 'New priority level.',
          },
          newDueDate: {
            type: 'string',
            description: 'New due date in YYYY-MM-DD format.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_today_tasks',
      description: "Get all user's tasks scheduled for today.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_upcoming_tasks',
      description: "Get user's upcoming tasks for the next 7 days.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_overdue_tasks',
      description: "Get user's overdue tasks that have passed their due date without being completed.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_routine_status',
      description: "Get user's daily habits checklist, completed habits count, and current streak days.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_productivity_summary',
      description: 'Get total productivity summary including task completion rate and streak info.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

/**
 * Builds the dynamic system prompt customized for the user and language.
 */
export function buildTaskPilotSystemPrompt(context = {}, language = 'en') {
  const langName =
    language === 'kn' ? 'Kannada (ಕನ್ನಡ)' : language === 'hi' ? 'Hindi (हिंदी)' : 'English';

  return `You are TaskPilot AI, an intelligent productivity and task management voice assistant.
User Profile:
- User Name: ${context.userName || 'User'}
- User Timezone: ${context.timezone || 'UTC'}
- Today's Date: ${context.today || new Date().toISOString().slice(0, 10)}
- Current Routine Streak: ${context.currentStreak || 0} days
- Daily Routine Completion: ${context.routinePercent || 0}%
- Active Tasks: ${context.activeTasksCount || 0}
- Overdue Tasks: ${context.overdueTasksCount || 0}

Language Instructions:
The user selected: ${langName}.
You must always reply concisely and naturally in the user's selected language or the language they speak in.

MANDATORY TOOL CALLING RULES:
You have real tools connected directly to the user's MongoDB database.
1. When the user asks to create, add, or schedule a task (e.g., "Create a task to finish the presentation tomorrow", "Add meeting with team on Friday", "Schedule doctor visit"):
   -> YOU MUST IMMEDIATELY CALL THE \`create_task\` TOOL!
2. When the user says they completed, finished, or want to check off a task:
   -> YOU MUST IMMEDIATELY CALL THE \`complete_task\` TOOL!
3. When the user wants to reschedule, move, or modify a task:
   -> YOU MUST IMMEDIATELY CALL THE \`update_task\` TOOL!
4. When the user asks what they have to do today or what's on their schedule:
   -> Call \`get_today_tasks\`!
5. When the user asks for upcoming deadlines:
   -> Call \`get_upcoming_tasks\`!
6. When the user asks for overdue tasks:
   -> Call \`get_overdue_tasks\`!
7. When the user asks about daily habits, routines, or streaks:
   -> Call \`get_routine_status\`!
8. When the user asks for a summary of their productivity:
   -> Call \`get_productivity_summary\`!

CRITICAL: NEVER claim you added or updated a task without calling the tool! Always invoke the tool first. After the tool returns, briefly confirm the action to the user in a warm, helpful manner.`;
}

/**
 * Starts a live voice session with Vapi.
 * 
 * @param {Object} options
 * @param {string} options.language - Selected language code ('en', 'kn', 'hi')
 * @param {Object} [options.context] - Dynamic user & workspace context (name, streak, sessionToken)
 * @param {string} [options.assistantId] - Custom assistant ID if overriding env var
 * @returns {Promise<any>}
 */
export async function startVapiCall({ language = 'en', context = {}, assistantId = '' }) {
  const vapi = getVapi();
  if (!vapi) {
    throw new Error('Vapi is not configured. Please add VITE_VAPI_PUBLIC_KEY to client/.env');
  }

  const targetAssistantId = (assistantId || VAPI_ASSISTANT_ID || '').trim();
  const systemPrompt = buildTaskPilotSystemPrompt(context, language);

  const initialGreeting =
    language === 'kn'
      ? `ನಮಸ್ಕಾರ ${context.userName ? context.userName.split(' ')[0] : ''}! ನಾನು ನಿಮ್ಮ ಟಾಸ್ಕ್‌ಪೈಲಟ್ ವಾಯ್ಸ್ ಅಸಿಸ್ಟೆಂಟ್. ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?`
      : language === 'hi'
      ? `नमस्ते ${context.userName ? context.userName.split(' ')[0] : ''}! मैं टास्कपायलट वॉइस असिस्टेंट हूँ। मैं आपकी क्या मदद कर सकता हूँ?`
      : `Hi ${context.userName ? context.userName.split(' ')[0] : 'there'}! I'm TaskPilot Voice Assistant. How can I help with your tasks today?`;

  // Standard model configuration equipped with TaskPilot tools
  const modelConfig = {
    provider: 'openai',
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
    ],
    tools: TASKPILOT_VOICE_TOOLS,
  };

  // Assistant overrides tailored for TaskPilot AI
  const assistantOverrides = {
    firstMessage: initialGreeting,
    variableValues: {
      userName: context.userName || 'User',
      timezone: context.timezone || 'UTC',
      todayDate: context.today || new Date().toISOString().slice(0, 10),
      currentStreak: String(context.currentStreak || 0),
      routinePercent: String(context.routinePercent || 0),
      activeTasksCount: String(context.activeTasksCount || 0),
      overdueTasksCount: String(context.overdueTasksCount || 0),
      userSessionToken: context.sessionToken || '',
      preferredLanguage: language,
    },
    model: modelConfig,
    clientMessages: [
      'transcript',
      'speech-update',
      'model-output',
      'tool-calls',
      'tool-calls-result',
      'function-call',
      'function-call-result',
      'status-update',
      'conversation-update',
    ],
  };

  // Configure multilingual transcriber hints
  if (language === 'kn') {
    assistantOverrides.transcriber = {
      provider: 'deepgram',
      language: 'kn',
    };
  } else if (language === 'hi') {
    assistantOverrides.transcriber = {
      provider: 'deepgram',
      language: 'hi',
    };
  } else {
    assistantOverrides.transcriber = {
      provider: 'deepgram',
      language: 'en',
    };
  }

  // Full inline assistant configuration (used directly or as fallback)
  const inlineAssistant = {
    name: 'TaskPilot Voice Assistant',
    firstMessage: initialGreeting,
    model: modelConfig,
    voice: {
      provider: '11labs',
      voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel
    },
    ...assistantOverrides,
  };

  // If a pre-configured assistant ID is available, try starting with that ID and overrides.
  // Fall back to inline definition if the dashboard assistant has conflicting settings.
  if (targetAssistantId && !targetAssistantId.includes('your_vapi_assistant_id')) {
    try {
      console.log(`Starting Vapi session with assistant ID: ${targetAssistantId}`);
      return await vapi.start(targetAssistantId, assistantOverrides);
    } catch (err) {
      console.warn('Starting with assistant ID encountered error, falling back to inline assistant definition:', err);
      return await vapi.start(inlineAssistant);
    }
  }

  console.log('Starting Vapi session with inline TaskPilot assistant definition');
  return await vapi.start(inlineAssistant);
}

/**
 * Stops the active Vapi voice session.
 */
export function stopVapiCall() {
  const vapi = getVapi();
  if (vapi) {
    try {
      vapi.stop();
    } catch (err) {
      console.warn('Error stopping Vapi call:', err);
    }
  }
}
