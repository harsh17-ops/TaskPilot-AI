import test from 'node:test';
import assert from 'node:assert/strict';
import { executeVoiceTool } from '../services/voiceToolsService.js';

test('executeVoiceTool rejects unknown tool names with descriptive error', async () => {
  await assert.rejects(
    async () => {
      await executeVoiceTool('mockUserId123', 'unsupported_tool_xyz', {});
    },
    {
      message: 'Tool "unsupported_tool_xyz" is not supported.',
    }
  );
});

test('createTask validates that title is present and non-empty', async () => {
  await assert.rejects(
    async () => {
      await executeVoiceTool('mockUserId123', 'create_task', { title: '   ' });
    },
    {
      message: 'Task title is required.',
    }
  );
});

test('updateTask requires either taskId or titleQuery', async () => {
  await assert.rejects(
    async () => {
      await executeVoiceTool('mockUserId123', 'update_task', { priority: 'high' });
    },
    {
      message: 'Specify taskId or titleQuery to identify the task to update.',
    }
  );
});

test('completeTask requires either taskId or titleQuery', async () => {
  await assert.rejects(
    async () => {
      await executeVoiceTool('mockUserId123', 'complete_task', {});
    },
    {
      message: 'Specify taskId or titleQuery to complete.',
    }
  );
});
