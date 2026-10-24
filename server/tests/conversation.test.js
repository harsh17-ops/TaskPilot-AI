import test from 'node:test';
import assert from 'node:assert/strict';
import { Conversation } from '../models/Conversation.js';

test('Conversation model defaults to mixed mode and en language', () => {
  const conv = new Conversation({
    userId: '507f1f77bcf86cd799439011',
  });

  assert.equal(conv.title, 'New Conversation');
  assert.equal(conv.mode, 'mixed');
  assert.equal(conv.language, 'en');
  assert.deepEqual(conv.messages, []);
  assert.ok(conv.lastActivityAt instanceof Date);
});

test('Conversation accepts multilingual language codes (en, kn, hi)', () => {
  const knConv = new Conversation({
    userId: '507f1f77bcf86cd799439011',
    language: 'kn',
    title: 'ಕನ್ನಡ ಸಂಭಾಷಣೆ',
  });
  assert.equal(knConv.language, 'kn');
  assert.equal(knConv.title, 'ಕನ್ನಡ ಸಂಭಾಷಣೆ');

  const hiConv = new Conversation({
    userId: '507f1f77bcf86cd799439011',
    language: 'hi',
    title: 'हिंदी वार्तालाप',
  });
  assert.equal(hiConv.language, 'hi');
});

test('Conversation message subdocuments support voice and text modes', () => {
  const conv = new Conversation({
    userId: '507f1f77bcf86cd799439011',
    messages: [
      {
        role: 'user',
        content: 'Tell me my tasks for today',
        mode: 'voice',
        language: 'en',
      },
      {
        role: 'assistant',
        content: 'You have 3 tasks due today.',
        mode: 'voice',
        language: 'en',
      },
    ],
  });

  assert.equal(conv.messages.length, 2);
  assert.equal(conv.messages[0].mode, 'voice');
  assert.equal(conv.messages[1].role, 'assistant');
});
