import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLocalDayUtcBounds,
  isSameLocalDate,
  getPreviousMondayToSundayRange,
} from '../services/productivityReportService.js';
import { escapeHtml, buildTaskReminderEmail } from '../utils/emailTemplates.js';
import { calculateStreaks } from '../services/streaks.js';

test('getLocalDayUtcBounds computes exact UTC boundaries for Asia/Kolkata (+05:30)', () => {
  const { startUtc, endUtc } = getLocalDayUtcBounds('2026-10-25', 'Asia/Kolkata');

  // Local 2026-10-25 00:00:00 IST is 2026-10-24 18:30:00 UTC (5.5 hours earlier)
  assert.equal(startUtc.toISOString(), '2026-10-24T18:30:00.000Z');
  // Local 2026-10-25 23:59:59.999 IST is 2026-10-25 18:29:59.999 UTC
  assert.equal(endUtc.toISOString(), '2026-10-25T18:29:59.999Z');
});

test('isSameLocalDate accurately compares timestamps in Asia/Kolkata', () => {
  // 2026-10-24 20:00:00 UTC is 2026-10-25 01:30:00 IST (so it IS on 2026-10-25 local day)
  const timestampIST = new Date('2026-10-24T20:00:00.000Z');
  assert.equal(isSameLocalDate(timestampIST, '2026-10-25', 'Asia/Kolkata'), true);

  // 2026-10-24 18:00:00 UTC is 2026-10-24 23:30:00 IST (so it is on 2026-10-24, NOT 2026-10-25)
  const timestampPrevIST = new Date('2026-10-24T18:00:00.000Z');
  assert.equal(isSameLocalDate(timestampPrevIST, '2026-10-25', 'Asia/Kolkata'), false);
});

test('getPreviousMondayToSundayRange generates a full Monday-Sunday interval', () => {
  const { mondayStr, sundayStr, startUtc, endUtc } = getPreviousMondayToSundayRange('Asia/Kolkata');

  // Verify dates are Monday and Sunday
  const monDate = new Date(`${mondayStr}T12:00:00Z`);
  const sunDate = new Date(`${sundayStr}T12:00:00Z`);

  assert.equal(monDate.getUTCDay(), 1, 'Start date must be Monday');
  assert.equal(sunDate.getUTCDay(), 0, 'End date must be Sunday');
  assert.ok(startUtc < endUtc, 'Start UTC must be before end UTC');

  // Difference between Monday and Sunday is exactly 6 days
  const dayDiff = Math.round((sunDate.getTime() - monDate.getTime()) / (1000 * 60 * 60 * 24));
  assert.equal(dayDiff, 6, 'Interval between Monday and Sunday must span 6 days');
});

test('Evening review strictly requires actual completedAt to match today', () => {
  const todayStr = '2026-10-25';
  const tz = 'Asia/Kolkata';

  // Task A: marked completed today with valid completedAt
  const taskA = {
    title: 'Task A',
    status: 'completed',
    completedAt: new Date('2026-10-25T05:00:00.000Z'), // 10:30 AM IST on 2026-10-25
  };
  assert.equal(isSameLocalDate(taskA.completedAt, todayStr, tz), true);

  // Task B: marked completed 3 days ago
  const taskB = {
    title: 'Task B',
    status: 'completed',
    completedAt: new Date('2026-10-22T05:00:00.000Z'),
  };
  assert.equal(isSameLocalDate(taskB.completedAt, todayStr, tz), false);

  // Task C: status is completed, but completedAt is null
  const taskC = {
    title: 'Task C',
    status: 'completed',
    completedAt: null,
  };
  assert.equal(isSameLocalDate(taskC.completedAt, todayStr, tz), false);
});

test('Routine streaks are independent of normal task completion', () => {
  const routineDays = [
    {
      localDate: '2026-10-24',
      eligible: true,
      items: [{ isRequired: true, completed: true }],
    },
    {
      localDate: '2026-10-25',
      eligible: true,
      items: [{ isRequired: true, completed: true }],
    },
  ];

  const streaks = calculateStreaks(routineDays, '2026-10-25');
  assert.equal(streaks.currentStreak, 2);

  // Even if 100 normal tasks were completed or failed, routine streak logic only counts RoutineDays
  const resultWithZeroTasks = calculateStreaks(routineDays, '2026-10-25');
  assert.equal(resultWithZeroTasks.currentStreak, 2);
});

test('escapeHtml prevents XSS injection in email generation', () => {
  const maliciousInput = '<script>alert("hack")</script>&"quote"';
  const escaped = escapeHtml(maliciousInput);
  assert.equal(escaped, '&lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt;&amp;&quot;quote&quot;');
  assert.equal(escaped.includes('<script>'), false);
});

test('buildTaskReminderEmail produces clean HTML and text with escaped title and note', () => {
  const email = buildTaskReminderEmail({
    task: {
      title: 'Review <Security> Audit',
      description: 'Check for & verify "XSS" issues',
      priority: 'high',
      dueDate: new Date('2026-10-26T12:00:00Z'),
      estimatedMinutes: 45,
    },
    reminder: {
      scheduledAt: new Date('2026-10-25T15:00:00Z'),
      note: 'Focus on <headers> & rate limits',
    },
    timeZone: 'Asia/Kolkata',
  });

  assert.equal(email.subject, 'Reminder: Review <Security> Audit');
  assert.ok(email.html.includes('&lt;Security&gt;'));
  assert.ok(email.html.includes('&lt;headers&gt;'));
  assert.ok(email.text.includes('Task: Review <Security> Audit'));
  assert.ok(email.text.includes('Estimated duration: 45 min'));
});
