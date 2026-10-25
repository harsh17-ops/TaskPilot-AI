import { Task, DeadlineNotificationLedger, User } from '../models/index.js';

/**
 * Deadline Service
 * 
 * Identifies unfinished tasks requiring deadline notifications, evaluates notification stages,
 * enforces waking hours, and deduplicates alerts via DeadlineNotificationLedger.
 */

export const WAKING_START_HOUR = 8;  // 8:00 AM
export const WAKING_END_HOUR = 22;   // 10:00 PM

/**
 * Checks whether the current local time in the specified timezone falls within waking hours.
 * 
 * @param {string} [timeZone='Asia/Kolkata']
 * @returns {boolean}
 */
export function isWithinWakingHours(timeZone = 'Asia/Kolkata') {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    });
    const currentHour = parseInt(formatter.format(new Date()), 10);
    return currentHour >= WAKING_START_HOUR && currentHour < WAKING_END_HOUR;
  } catch (err) {
    return true; // Default to allowing notifications if timezone parsing fails
  }
}

/**
 * Gets local date string in YYYY-MM-DD for a timezone.
 */
export function getLocalDateStr(timeZone = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Retrieves incomplete tasks needing deadline alerts, categorized by stage.
 * Deduplicates against DeadlineNotificationLedger to ensure notifications are not repeatedly fired.
 * 
 * @param {string} userId
 * @param {Object} options
 * @returns {Promise<Array<{ task: Object, stage: string, deadlineValue: Date, reportingWindow?: string }>>}
 */
export async function getTasksNeedingDeadlineAlerts(userId, { checkWakingHours = true, timeZone = 'Asia/Kolkata' } = {}) {
  if (checkWakingHours && !isWithinWakingHours(timeZone)) {
    return []; // Suppress automatic deadline alerts during resting hours
  }

  const now = new Date();
  const todayStr = getLocalDateStr(timeZone);

  // Fetch all incomplete tasks for user
  const incompleteTasks = await Task.find({
    userId,
    status: { $ne: 'completed' },
  }).sort({ dueDate: 1 });

  // Fetch all existing notification ledger records for user
  const existingLedgerEntries = await DeadlineNotificationLedger.find({ userId });
  const ledgerMap = new Set(
    existingLedgerEntries.map((entry) => {
      const deadlineStr = entry.deadlineValue ? entry.deadlineValue.toISOString() : 'null';
      const windowStr = entry.reportingWindow || 'any';
      return `${entry.taskId}_${entry.stage}_${deadlineStr}_${windowStr}`;
    })
  );

  const alerts = [];

  for (const task of incompleteTasks) {
    if (!task.dueDate) {
      // High-priority unfinished tasks without specific due dates (alert once per day)
      if (task.priority === 'urgent' || task.priority === 'high') {
        const stage = 'high_priority_unfinished';
        const key = `${task._id}_${stage}_null_${todayStr}`;
        if (!ledgerMap.has(key)) {
          alerts.push({
            task,
            stage,
            deadlineValue: null,
            reportingWindow: todayStr,
          });
        }
      }
      continue;
    }

    const dueDate = new Date(task.dueDate);
    const timeDiffMs = dueDate.getTime() - now.getTime();
    const hoursDiff = timeDiffMs / (1000 * 60 * 60);

    let stage = null;
    let reportingWindow = null;

    if (hoursDiff < 0) {
      // Overdue
      stage = 'overdue';
      reportingWindow = todayStr; // Once per day while overdue
    } else if (hoursDiff <= 24) {
      // Approaching soon (< 24 hours)
      stage = 'approaching';
    } else if (hoursDiff <= 48) {
      // Upcoming (24-48 hours)
      stage = 'upcoming';
    } else if (task.priority === 'urgent' || task.priority === 'high') {
      // High priority task remaining unfinished
      stage = 'high_priority_unfinished';
      reportingWindow = todayStr;
    }

    if (stage) {
      const deadlineStr = dueDate.toISOString();
      const windowStr = reportingWindow || 'any';
      const key = `${task._id}_${stage}_${deadlineStr}_${windowStr}`;

      if (!ledgerMap.has(key)) {
        alerts.push({
          task,
          stage,
          deadlineValue: dueDate,
          reportingWindow,
        });
      }
    }
  }

  return alerts;
}

/**
 * Records that a deadline notification was sent in the ledger.
 */
export async function recordDeadlineAlert({ userId, taskId, stage, deadlineValue, reportingWindow }) {
  return DeadlineNotificationLedger.findOneAndUpdate(
    {
      userId,
      taskId,
      stage,
      deadlineValue: deadlineValue ? new Date(deadlineValue) : null,
      reportingWindow: reportingWindow || null,
    },
    {
      $setOnInsert: {
        userId,
        taskId,
        stage,
        deadlineValue: deadlineValue ? new Date(deadlineValue) : null,
        reportingWindow: reportingWindow || null,
        sentAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
}

/**
 * Invalidates obsolete deadline ledger entries when a task deadline changes or is completed.
 */
export async function invalidateTaskDeadlines(taskId) {
  return DeadlineNotificationLedger.deleteMany({ taskId });
}
