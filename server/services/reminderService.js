import { Reminder, Task } from '../models/index.js';

export const MAX_DELIVERY_ATTEMPTS = 3;
export const DEFAULT_LEASE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Reminder Service
 * 
 * Provides task reminder management, atomic worker claiming with leases,
 * bounded retries with exponential backoff, and lifecycle coordination with tasks.
 */

/**
 * Creates a reminder for an owned task.
 */
export async function createReminder({ userId, taskId, scheduledAt, timezone = 'Asia/Kolkata', note = '' }) {
  if (!taskId) {
    throw new Error('Task ID is required.');
  }

  const task = await Task.findOne({ _id: taskId, userId });
  if (!task) {
    throw new Error('Task not found or access denied.');
  }

  if (task.status === 'completed') {
    throw new Error('Cannot set a reminder for a completed task.');
  }

  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime())) {
    throw new Error('Invalid reminder date/time.');
  }

  // Enforce future time (allowing 60-second grace window for immediate dispatch)
  const graceWindowMs = 60 * 1000;
  if (scheduledDate.getTime() < Date.now() - graceWindowMs) {
    throw new Error('Reminder cannot be scheduled in the past.');
  }

  const reminder = await Reminder.create({
    userId,
    taskId,
    scheduledAt: scheduledDate,
    timezone,
    note: (note || '').trim(),
    status: 'pending',
  });

  return reminder;
}

/**
 * Retrieves all reminders for a specific task.
 */
export async function getRemindersForTask(userId, taskId) {
  const task = await Task.findOne({ _id: taskId, userId });
  if (!task) {
    throw new Error('Task not found or access denied.');
  }

  return Reminder.find({ userId, taskId }).sort({ scheduledAt: 1 });
}

/**
 * Retrieves all reminders for an authenticated user with optional status filter.
 */
export async function getUserReminders(userId, { status, taskId } = {}) {
  const query = { userId };
  if (status) query.status = status;
  if (taskId) query.taskId = taskId;

  return Reminder.find(query)
    .populate('taskId', 'title priority status dueDate')
    .sort({ scheduledAt: 1 });
}

/**
 * Updates a reminder.
 */
export async function updateReminder(userId, reminderId, { scheduledAt, timezone, note, status }) {
  const reminder = await Reminder.findOne({ _id: reminderId, userId });
  if (!reminder) {
    throw new Error('Reminder not found.');
  }

  if (reminder.status === 'sent') {
    throw new Error('Delivered reminders cannot be edited.');
  }

  if (status === 'cancelled') {
    reminder.status = 'cancelled';
    reminder.processingLeaseUntil = null;
    await reminder.save();
    return reminder;
  }

  if (scheduledAt) {
    const newScheduledDate = new Date(scheduledAt);
    if (isNaN(newScheduledDate.getTime())) {
      throw new Error('Invalid scheduledAt timestamp.');
    }
    if (newScheduledDate.getTime() < Date.now() - 60000) {
      throw new Error('Reminder cannot be rescheduled to a past time.');
    }
    reminder.scheduledAt = newScheduledDate;
    // Rescheduling resets delivery state so worker will deliver at new time
    reminder.status = 'pending';
    reminder.attemptCount = 0;
    reminder.nextAttemptAt = null;
    reminder.lastError = null;
    reminder.processingLeaseUntil = null;
  }

  if (timezone) reminder.timezone = timezone;
  if (note !== undefined) reminder.note = note.trim();

  await reminder.save();
  return reminder;
}

/**
 * Cancels a reminder.
 */
export async function cancelReminder(userId, reminderId) {
  const reminder = await Reminder.findOneAndUpdate(
    { _id: reminderId, userId },
    { $set: { status: 'cancelled', processingLeaseUntil: null } },
    { new: true }
  );

  if (!reminder) {
    throw new Error('Reminder not found.');
  }

  return reminder;
}

/**
 * Cancels all active (pending/processing) reminders for a given task.
 * Called automatically when a task is completed or deleted.
 */
export async function cancelPendingRemindersForTask(taskId) {
  return Reminder.updateMany(
    {
      taskId,
      status: { $in: ['pending', 'processing'] },
    },
    {
      $set: {
        status: 'cancelled',
        processingLeaseUntil: null,
      },
    }
  );
}

/**
 * Fetches reminders that are due for delivery for a specific user (or all users if userId is null).
 */
export async function getDueReminders(userId = null) {
  const now = new Date();
  const query = {
    $or: [
      { status: 'pending', scheduledAt: { $lte: now } },
      // Stale claim recovery: lease expired while in processing
      { status: 'processing', processingLeaseUntil: { $lte: now } },
      // Retry eligible failed reminders
      { status: 'failed', nextAttemptAt: { $lte: now }, attemptCount: { $lt: MAX_DELIVERY_ATTEMPTS } },
    ],
  };

  if (userId) {
    query.userId = userId;
  }

  return Reminder.find(query)
    .populate('taskId', 'title description priority status dueDate estimatedMinutes')
    .sort({ scheduledAt: 1 })
    .limit(50);
}

/**
 * Atomically claims a due reminder for processing with a lease duration.
 * Prevents race conditions and duplicate delivery across concurrent workers.
 * Also verifies task state: if task is completed or deleted, cancels the reminder immediately.
 * 
 * @param {string} reminderId
 * @param {number} [leaseDurationMs=300000]
 * @returns {Promise<{ reminder: Object|null, valid: boolean, reason?: string }>}
 */
export async function claimDueReminder(reminderId, leaseDurationMs = DEFAULT_LEASE_DURATION_MS) {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + leaseDurationMs);

  const claimedReminder = await Reminder.findOneAndUpdate(
    {
      _id: reminderId,
      $or: [
        { status: 'pending', scheduledAt: { $lte: now } },
        { status: 'processing', processingLeaseUntil: { $lte: now } },
        { status: 'failed', nextAttemptAt: { $lte: now }, attemptCount: { $lt: MAX_DELIVERY_ATTEMPTS } },
      ],
    },
    {
      $set: {
        status: 'processing',
        processingLeaseUntil: leaseUntil,
        lastAttemptAt: now,
      },
      $inc: { attemptCount: 1 },
    },
    { new: true }
  ).populate('taskId');

  if (!claimedReminder) {
    return { reminder: null, valid: false, reason: 'Reminder not due, already claimed, or not found' };
  }

  // Validate associated task
  const task = claimedReminder.taskId;
  if (!task) {
    // Task was deleted
    claimedReminder.status = 'cancelled';
    claimedReminder.processingLeaseUntil = null;
    claimedReminder.lastError = 'Associated task was deleted.';
    await claimedReminder.save();
    return { reminder: claimedReminder, valid: false, reason: 'Task was deleted' };
  }

  if (task.status === 'completed') {
    // Task was already completed
    claimedReminder.status = 'cancelled';
    claimedReminder.processingLeaseUntil = null;
    claimedReminder.lastError = 'Task was marked completed before delivery.';
    await claimedReminder.save();
    return { reminder: claimedReminder, valid: false, reason: 'Task was completed' };
  }

  return { reminder: claimedReminder, valid: true };
}

/**
 * Records the outcome of a delivery attempt.
 * If successful: marks as sent.
 * If failed: checks attemptCount, applies backoff retry or marks permanently failed.
 */
export async function recordDeliveryResult(reminderId, { success, providerMessageId = null, error = null }) {
  const reminder = await Reminder.findById(reminderId);
  if (!reminder) {
    throw new Error('Reminder not found.');
  }

  // Prevent overwriting a previously successful delivery
  if (reminder.status === 'sent') {
    return reminder;
  }

  if (success) {
    reminder.status = 'sent';
    reminder.sentAt = new Date();
    reminder.providerMessageId = providerMessageId;
    reminder.lastError = null;
    reminder.processingLeaseUntil = null;
    reminder.nextAttemptAt = null;
    await reminder.save();
    return reminder;
  }

  // Failure Handling: sanitize error string
  const sanitizedError = error ? String(error).slice(0, 1000) : 'Unknown delivery failure';
  reminder.lastError = sanitizedError;
  reminder.processingLeaseUntil = null;

  if (reminder.attemptCount < MAX_DELIVERY_ATTEMPTS) {
    // Exponential backoff: 2^attemptCount minutes (e.g. 2 min, 4 min)
    const backoffMinutes = Math.pow(2, reminder.attemptCount);
    reminder.nextAttemptAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
    reminder.status = 'failed';
  } else {
    // Exhausted retries -> permanently failed
    reminder.status = 'failed';
    reminder.nextAttemptAt = null;
  }

  await reminder.save();
  return reminder;
}
