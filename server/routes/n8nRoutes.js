import express from 'express';
import { authenticateN8n, n8nRateLimiter } from '../middleware/n8nAuth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  getDueReminders,
  claimDueReminder,
  recordDeliveryResult,
  cancelReminder,
} from '../services/reminderService.js';
import {
  getTasksNeedingDeadlineAlerts,
  recordDeadlineAlert,
} from '../services/deadlineService.js';
import {
  getMorningBriefingData,
  getEveningReviewData,
  getWeeklyReportData,
  getRoutineSummary,
} from '../services/productivityReportService.js';
import {
  buildTaskReminderEmail,
  buildDeadlineAlertEmail,
  buildMorningBriefingEmail,
  buildEveningReviewEmail,
  buildWeeklyReportEmail,
} from '../utils/emailTemplates.js';

const router = express.Router();

// Apply rate limiting and server-to-server authentication
router.use(n8nRateLimiter);
router.use(authenticateN8n);

/**
 * GET /api/n8n/health or /api/automation/health
 * Verifies that the n8n automation key is valid and target user is resolved.
 */
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    return res.json({
      ok: true,
      user: {
        id: req.n8nUser._id,
        name: req.n8nUser.name,
        email: req.n8nUser.email,
        timezone: req.n8nUser.timezone || 'Asia/Kolkata',
      },
      recipientEmail: process.env.MY_EMAIL || req.n8nUser.email,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * GET /api/n8n/reminders/due or /api/automation/reminders/due
 * Retrieves reminders due for delivery for the resolved automation user.
 * Supports both JSON array and wrapped object formats for flexible workflow parsing.
 */
router.get(
  '/reminders/due',
  asyncHandler(async (req, res) => {
    const dueList = await getDueReminders(req.n8nUser._id);
    const timezone = req.n8nUser.timezone || 'Asia/Kolkata';
    const recipient = process.env.MY_EMAIL || req.n8nUser.email;

    const formattedReminders = dueList.map((rem) => {
      const emailPayload = rem.taskId
        ? buildTaskReminderEmail({
            task: rem.taskId,
            reminder: rem,
            timeZone: timezone,
          })
        : null;

      return {
        id: rem._id,
        _id: rem._id,
        userId: rem.userId,
        taskId: rem.taskId?._id,
        scheduledAt: rem.scheduledAt,
        status: rem.status,
        attemptCount: rem.attemptCount,
        note: rem.note,
        recipientEmail: recipient,
        email: emailPayload,
        task: rem.taskId
          ? {
              id: rem.taskId._id,
              _id: rem.taskId._id,
              title: rem.taskId.title,
              description: rem.taskId.description,
              priority: rem.taskId.priority,
              status: rem.taskId.status,
              dueDate: rem.taskId.dueDate,
              estimatedMinutes: rem.taskId.estimatedMinutes,
            }
          : null,
      };
    });

    if (req.baseUrl.includes('automation') || req.query.format === 'array') {
      return res.json(formattedReminders);
    }

    return res.json({
      count: formattedReminders.length,
      reminders: formattedReminders,
    });
  })
);

/**
 * POST /api/n8n/reminders/:id/claim or /api/automation/reminders/:id/claim
 * Atomically claims a due reminder with a lease.
 * Returns { claimed, reminder, task } as expected by n8n workflow verification steps.
 */
router.post(
  '/reminders/:id/claim',
  asyncHandler(async (req, res) => {
    const leaseDurationMs = req.body.leaseDurationMs || 5 * 60 * 1000;
    const { reminder, valid, reason } = await claimDueReminder(req.params.id, leaseDurationMs);

    if (!reminder || !valid) {
      return res.status(409).json({
        claimed: false,
        reminder: null,
        task: null,
        reason: reason || 'Reminder not claimable or already claimed.',
      });
    }

    const taskData = reminder.taskId
      ? {
          id: reminder.taskId._id,
          _id: reminder.taskId._id,
          title: reminder.taskId.title,
          description: reminder.taskId.description,
          priority: reminder.taskId.priority,
          status: reminder.taskId.status,
          dueDate: reminder.taskId.dueDate,
          estimatedMinutes: reminder.taskId.estimatedMinutes,
        }
      : null;

    const reminderData = {
      id: reminder._id,
      _id: reminder._id,
      taskId: reminder.taskId?._id,
      status: reminder.status,
      attemptCount: reminder.attemptCount,
      scheduledAt: reminder.scheduledAt,
      processingLeaseUntil: reminder.processingLeaseUntil,
      note: reminder.note,
    };

    return res.json({
      claimed: true,
      reminder: reminderData,
      task: taskData,
      reminderId: reminder._id,
      status: reminder.status,
      attemptCount: reminder.attemptCount,
      processingLeaseUntil: reminder.processingLeaseUntil,
    });
  })
);

/**
 * POST /api/automation/reminders/:id/cancel
 * Cancels an ineligible reminder during n8n verification.
 */
router.post(
  '/reminders/:id/cancel',
  asyncHandler(async (req, res) => {
    const reminder = await cancelReminder(req.n8nUser._id, req.params.id);
    return res.json({ success: true, claimed: false, cancelled: true, reminder });
  })
);

/**
 * POST /api/automation/reminders/:id/sent
 * Records delivery after successful email send.
 */
router.post(
  '/reminders/:id/sent',
  asyncHandler(async (req, res) => {
    const messageId =
      req.body.messageId ||
      req.body.providerMessageId ||
      req.body.id ||
      'sent-' + Date.now();

    const updated = await recordDeliveryResult(req.params.id, {
      success: true,
      providerMessageId: messageId,
    });

    return res.json({
      success: true,
      status: updated.status,
      sentAt: updated.sentAt,
      reminder: updated,
    });
  })
);

/**
 * POST /api/automation/reminders/:id/fail
 * Records delivery failure with backoff retry.
 */
router.post(
  '/reminders/:id/fail',
  asyncHandler(async (req, res) => {
    const errorMsg =
      req.body.error ||
      req.body.message ||
      req.body.lastError ||
      'Delivery failure';

    const updated = await recordDeliveryResult(req.params.id, {
      success: false,
      error: errorMsg,
    });

    return res.json({
      success: true,
      status: updated.status,
      attemptCount: updated.attemptCount,
      nextAttemptAt: updated.nextAttemptAt,
      reminder: updated,
    });
  })
);

/**
 * POST /api/n8n/reminders/:id/result
 * Records delivery outcome (success or failure) and applies bounded retries.
 */
router.post(
  '/reminders/:id/result',
  asyncHandler(async (req, res) => {
    const { success, providerMessageId, error } = req.body;

    const updated = await recordDeliveryResult(req.params.id, {
      success: Boolean(success),
      providerMessageId,
      error,
    });

    return res.json({
      ok: true,
      status: updated.status,
      sentAt: updated.sentAt,
      attemptCount: updated.attemptCount,
      nextAttemptAt: updated.nextAttemptAt,
    });
  })
);

/**
 * GET /api/n8n/deadline-alerts
 * Retrieves incomplete tasks requiring deadline alerts with stage evaluation and deduplication.
 */
router.get(
  '/deadline-alerts',
  asyncHandler(async (req, res) => {
    const checkWaking = req.query.checkWaking !== 'false';
    const timezone = req.n8nUser.timezone || 'Asia/Kolkata';
    const recipient = process.env.MY_EMAIL || req.n8nUser.email;

    const alertItems = await getTasksNeedingDeadlineAlerts(req.n8nUser._id, {
      checkWakingHours: checkWaking,
      timeZone: timezone,
    });

    const formattedAlerts = alertItems.map(({ task, stage, deadlineValue, reportingWindow }) => {
      const emailPayload = buildDeadlineAlertEmail({
        task,
        stage,
        timeZone: timezone,
      });

      return {
        taskId: task._id,
        stage,
        deadlineValue,
        reportingWindow,
        recipientEmail: recipient,
        email: emailPayload,
        task: {
          id: task._id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          dueDate: task.dueDate,
          estimatedMinutes: task.estimatedMinutes,
        },
      };
    });

    if (req.baseUrl.includes('automation') || req.query.format === 'array') {
      return res.json(formattedAlerts);
    }

    return res.json({
      count: formattedAlerts.length,
      alerts: formattedAlerts,
    });
  })
);

/**
 * POST /api/n8n/deadline-alerts/record
 * Records that a deadline alert was successfully sent in the ledger.
 */
router.post(
  '/deadline-alerts/record',
  asyncHandler(async (req, res) => {
    const { taskId, stage, deadlineValue, reportingWindow } = req.body;

    if (!taskId || !stage) {
      return res.status(400).json({ error: 'taskId and stage are required.' });
    }

    const entry = await recordDeadlineAlert({
      userId: req.n8nUser._id,
      taskId,
      stage,
      deadlineValue,
      reportingWindow,
    });

    return res.json({ ok: true, ledgerId: entry._id });
  })
);

/**
 * GET /api/n8n/reports/morning
 * Retrieves morning briefing data for today based on Asia/Kolkata date boundaries.
 */
router.get(
  '/reports/morning',
  asyncHandler(async (req, res) => {
    const timezone = req.n8nUser.timezone || 'Asia/Kolkata';
    const recipient = process.env.MY_EMAIL || req.n8nUser.email;

    const briefingData = await getMorningBriefingData(req.n8nUser._id, timezone);

    const emailPayload = buildMorningBriefingEmail({
      dateStr: briefingData.date,
      user: briefingData.user,
      tasksDueToday: briefingData.tasksDueToday,
      overdueTasks: briefingData.overdueTasks,
      highPriorityTasks: briefingData.highPriorityIncomplete,
      routineSummary: briefingData.routineSummary,
    });

    return res.json({
      ...briefingData,
      recipientEmail: recipient,
      email: emailPayload,
    });
  })
);

/**
 * GET /api/n8n/reports/evening
 * Retrieves evening review data based on actual completion timestamps.
 */
router.get(
  '/reports/evening',
  asyncHandler(async (req, res) => {
    const timezone = req.n8nUser.timezone || 'Asia/Kolkata';
    const recipient = process.env.MY_EMAIL || req.n8nUser.email;

    const eveningData = await getEveningReviewData(req.n8nUser._id, timezone);

    const emailPayload = buildEveningReviewEmail({
      dateStr: eveningData.date,
      user: eveningData.user,
      completedToday: eveningData.completedToday,
      remainingTasks: eveningData.pendingTasks,
      routineStatus: eveningData.routineStatus,
      streakInfo: eveningData.streaks,
    });

    return res.json({
      ...eveningData,
      recipientEmail: recipient,
      email: emailPayload,
    });
  })
);

/**
 * GET /api/n8n/reports/weekly
 * Retrieves weekly productivity data for the preceding Monday-Sunday.
 */
router.get(
  '/reports/weekly',
  asyncHandler(async (req, res) => {
    const timezone = req.n8nUser.timezone || 'Asia/Kolkata';
    const recipient = process.env.MY_EMAIL || req.n8nUser.email;

    const weeklyData = await getWeeklyReportData(req.n8nUser._id, timezone);

    const emailPayload = buildWeeklyReportEmail({
      user: weeklyData.user,
      periodLabel: weeklyData.period.label,
      completedCount: weeklyData.metrics.completedCount,
      overdueCount: weeklyData.metrics.overdueCount,
      openCount: weeklyData.metrics.openCount,
      streakInfo: weeklyData.routineStreaks,
      routineCompletionRate: weeklyData.metrics.routineConsistencyRate,
    });

    return res.json({
      ...weeklyData,
      recipientEmail: recipient,
      email: emailPayload,
    });
  })
);

/**
 * GET /api/n8n/routine-summary
 * Read-only routine completion and streak statistics from existing backend service.
 */
router.get(
  '/routine-summary',
  asyncHandler(async (req, res) => {
    const timezone = req.n8nUser.timezone || 'Asia/Kolkata';
    const summary = await getRoutineSummary(req.n8nUser._id, timezone);
    return res.json(summary);
  })
);

export default router;
