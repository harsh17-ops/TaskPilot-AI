import mongoose from 'mongoose';

/**
 * DeadlineNotificationLedger Schema
 * 
 * Persistent ledger for automated deadline notifications.
 * Deduplicates automated deadline reminders across n8n poll cycles:
 * - Upcoming deadline (e.g. 24-48h before)
 * - Approaching soon (e.g. within 24h)
 * - Overdue task
 * - High-priority task remaining unfinished
 * 
 * Tracks the specific deadline value (dueDate) when alerted so that if the user
 * reschedules the deadline, new appropriate alerts can be sent without obsolete repeats.
 */
const deadlineNotificationLedgerSchema = new mongoose.Schema(
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
    stage: {
      type: String,
      enum: ['upcoming', 'approaching', 'overdue', 'high_priority_unfinished'],
      required: true,
    },
    deadlineValue: {
      type: Date,
      default: null,
    },
    reportingWindow: {
      type: String,
      default: null, // e.g. 'YYYY-MM-DD' for daily reminders
    },
    sentAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring idempotency per user, task, stage, deadline, and reporting window
deadlineNotificationLedgerSchema.index(
  { userId: 1, taskId: 1, stage: 1, deadlineValue: 1, reportingWindow: 1 },
  { unique: true }
);

export const DeadlineNotificationLedger = mongoose.model(
  'DeadlineNotificationLedger',
  deadlineNotificationLedgerSchema
);
export default DeadlineNotificationLedger;
