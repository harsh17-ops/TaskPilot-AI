import mongoose from 'mongoose';

/**
 * Reminder Schema
 * 
 * Represents a scheduled notification/reminder for a specific user task.
 * 
 * State Lifecycle:
 * - 'pending': Scheduled and waiting for delivery time.
 * - 'processing': Claimed atomically by an automation worker with a timed lease.
 * - 'sent': Successfully delivered to the user via email/notification provider.
 * - 'cancelled': Inactivated because the user cancelled it, or the task was completed/deleted.
 * - 'failed': Delivery attempted but failed; may be eligible for retry if attemptCount < maxAttempts.
 * 
 * Duplicate Prevention & Reliability:
 * - Atomic conditional claiming: workers must atomically update status from pending to processing
 *   with a lease timestamp (`processingLeaseUntil`).
 * - Stale claim recovery: if a worker crashes, expired leases can be safely reclaimed.
 */
const reminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
      index: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'cancelled', 'failed'],
      default: 'pending',
      index: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    nextAttemptAt: {
      type: Date,
      default: null,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    processingLeaseUntil: {
      type: Date,
      default: null,
      index: true,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    providerMessageId: {
      type: String,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for user querying and reliable delivery scheduling
reminderSchema.index({ userId: 1, taskId: 1, status: 1 });
reminderSchema.index({ status: 1, scheduledAt: 1, processingLeaseUntil: 1 });

export const Reminder = mongoose.model('Reminder', reminderSchema);
export default Reminder;
