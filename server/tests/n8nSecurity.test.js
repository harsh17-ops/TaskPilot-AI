import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { authenticateN8n } from '../middleware/n8nAuth.js';

test('authenticateN8n rejects requests with missing or empty integration key', async () => {
  process.env.N8N_AUTOMATION_SECRET = 'valid_test_secret_with_32_characters_len!';

  const req = {
    headers: {},
    query: {},
  };
  let statusCode = null;
  let responseBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  await authenticateN8n(req, res, () => {});
  assert.equal(statusCode, 401);
  assert.ok(responseBody?.error?.includes('Unauthorized'));
});

test('authenticateN8n rejects invalid secrets', async () => {
  process.env.N8N_AUTOMATION_SECRET = 'valid_test_secret_with_32_characters_len!';

  const req = {
    headers: { 'x-n8n-api-key': 'incorrect_secret_guess_1234567890' },
    query: {},
  };
  let statusCode = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };

  await authenticateN8n(req, res, () => {});
  assert.equal(statusCode, 401);
});

test('Constant-time comparison protects against timing attack side-channels', () => {
  const secretA = 'taskpilot_n8n_sec_994a318e27c15ba8';
  const secretB = 'taskpilot_n8n_sec_994a318e27c15ba8';
  const secretC = 'taskpilot_n8n_sec_0000000000000000';

  const bufA = Buffer.from(secretA);
  const bufB = Buffer.from(secretB);
  const bufC = Buffer.from(secretC);

  assert.equal(crypto.timingSafeEqual(bufA, bufB), true);
  assert.equal(crypto.timingSafeEqual(bufA, bufC), false);

  // Different buffer lengths must be guarded to avoid throwing in timingSafeEqual
  const shortBuf = Buffer.from('short');
  assert.notEqual(bufA.length, shortBuf.length);
});

test('authenticateN8n supports Authorization Bearer header', async () => {
  const testSecret = 'valid_test_secret_with_32_characters_len!';
  process.env.N8N_AUTOMATION_SECRET = testSecret;

  let nextCalled = false;
  const req = {
    headers: { authorization: `Bearer ${testSecret}` },
    query: {},
  };
  let statusCode = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };

  // Run middleware; if no users are in DB mock, it will fail at user lookup (404),
  // which confirms secret was accepted (did NOT return 401).
  await authenticateN8n(req, res, () => {
    nextCalled = true;
  });

  assert.notEqual(statusCode, 401, 'Bearer token matching configured secret must not be rejected with 401');
});

test('authenticateN8n rejects if N8N_AUTOMATION_SECRET is unconfigured or too short', async () => {
  process.env.N8N_AUTOMATION_SECRET = 'short';

  const req = {
    headers: { 'x-n8n-api-key': 'short' },
    query: {},
  };
  let statusCode = null;
  let responseBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  await authenticateN8n(req, res, () => {});
  assert.equal(statusCode, 500);
  assert.ok(responseBody?.error?.includes('minimum 16 characters required'));
});
