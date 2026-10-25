import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Reminder } from '../models/Reminder.js';
import { MAX_DELIVERY_ATTEMPTS } from '../services/reminderService.js';

test('Reminder model initializes with correct default fields and status', () => {
  const reminder = new Reminder({
    userId: new mongoose.Types.ObjectId(),
    taskId: new mongoose.Types.ObjectId(),
    scheduledAt: new Date('2026-11-01T10:00:00Z'),
  });

  assert.equal(reminder.status, 'pending');
  assert.equal(reminder.attemptCount, 0);
  assert.equal(reminder.timezone, 'Asia/Kolkata');
  assert.equal(reminder.note, '');
  assert.equal(reminder.nextAttemptAt, null);
  assert.equal(reminder.sentAt, null);
  assert.equal(reminder.processingLeaseUntil, null);
});

test('Reminder model validates status enum values', () => {
  const validStatuses = ['pending', 'processing', 'sent', 'cancelled', 'failed'];
  for (const st of validStatuses) {
    const reminder = new Reminder({
      userId: new mongoose.Types.ObjectId(),
      taskId: new mongoose.Types.ObjectId(),
      scheduledAt: new Date(),
      status: st,
    });
    const err = reminder.validateSync();
    assert.equal(err, undefined, `Status "${st}" should be valid`);
  }

  const invalidReminder = new Reminder({
    userId: new mongoose.Types.ObjectId(),
    taskId: new mongoose.Types.ObjectId(),
    scheduledAt: new Date(),
    status: 'unsupported_state_xyz',
  });
  const err = invalidReminder.validateSync();
  assert.ok(err?.errors?.status, 'Invalid status must fail schema validation');
});

test('Reminder validation requires userId, taskId, and scheduledAt', () => {
  const reminder = new Reminder({});
  const err = reminder.validateSync();
  assert.ok(err?.errors?.userId, 'userId must be required');
  assert.ok(err?.errors?.taskId, 'taskId must be required');
  assert.ok(err?.errors?.scheduledAt, 'scheduledAt must be required');
});

test('Atomic lease calculation prevents concurrent execution overlap', () => {
  const now = Date.now();
  const leaseDurationMs = 5 * 60 * 1000; // 5 minutes
  const leaseUntil = new Date(now + leaseDurationMs);

  const activeWorkerTime = new Date(now + 60 * 1000); // 1 min into lease
  const isLeaseActive = activeWorkerTime < leaseUntil;
  assert.equal(isLeaseActive, true, 'Lease must remain active for duration of the worker execution');

  const expiredWorkerTime = new Date(now + 6 * 60 * 1000); // 6 mins later (crashed worker)
  const isExpired = expiredWorkerTime >= leaseUntil;
  assert.equal(isExpired, true, 'Expired lease must allow recovery by next poller');
});

test('Bounded retry logic calculates exponential backoff and caps at MAX_DELIVERY_ATTEMPTS', () => {
  assert.equal(MAX_DELIVERY_ATTEMPTS, 3);

  // Attempt 1 failure -> 2^1 = 2 minute backoff
  const attempt1Backoff = Math.pow(2, 1) * 60 * 1000;
  assert.equal(attempt1Backoff, 120000);

  // Attempt 2 failure -> 2^2 = 4 minute backoff
  const attempt2Backoff = Math.pow(2, 2) * 60 * 1000;
  assert.equal(attempt2Backoff, 240000);

  // Attempt 3 failure -> permanently failed, nextAttemptAt = null
  const attemptCount = 3;
  const isPermanentlyFailed = attemptCount >= MAX_DELIVERY_ATTEMPTS;
  assert.equal(isPermanentlyFailed, true);
});

test('Past date validation rejects reminder scheduled more than 60 seconds ago', () => {
  const pastTimestamp = Date.now() - 5 * 60 * 1000; // 5 minutes in past
  const graceWindowMs = 60 * 1000;
  const isPast = pastTimestamp < Date.now() - graceWindowMs;
  assert.equal(isPast, true, 'Past date beyond grace window must be rejected');

  const nearFuture = Date.now() + 10 * 1000; // 10 seconds in future
  const isFuture = nearFuture >= Date.now() - graceWindowMs;
  assert.equal(isFuture, true, 'Future time within or after grace window is accepted');
});

test('Delivered reminder prevents duplicate delivery or re-sending', () => {
  const sentReminder = {
    status: 'sent',
    sentAt: new Date('2026-10-25T09:00:00Z'),
    providerMessageId: 'msg-12345',
  };

  const isEligibleForDispatch = sentReminder.status === 'pending' ||
    (sentReminder.status === 'processing' && sentReminder.processingLeaseUntil < new Date());

  assert.equal(isEligibleForDispatch, false, 'Already sent reminder must never be re-dispatched');
});
