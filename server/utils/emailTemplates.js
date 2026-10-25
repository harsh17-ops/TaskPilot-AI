/**
 * Email Templates & Formatting Utility
 * 
 * Generates responsive, beautifully styled HTML emails with plain-text fallbacks
 * for task reminders, deadline notifications, and productivity reports.
 * 
 * Features:
 * - HTML escaping to prevent injection attacks from user-provided task titles/notes.
 * - Inline CSS compatible with Gmail, Apple Mail, Outlook, and webmail clients.
 * - Prominent action summaries, clean badge colors, and clear timestamps in user timezone.
 */

/**
 * Escapes HTML characters in user-provided input strings.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats a date into a human-readable string in the specified timezone.
 * @param {Date|string} date
 * @param {string} [timeZone='Asia/Kolkata']
 * @returns {string}
 */
export function formatDateTime(date, timeZone = 'Asia/Kolkata') {
  if (!date) return 'Not set';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(date));
  } catch (err) {
    return new Date(date).toLocaleString();
  }
}

/**
 * Returns common email wrapper layout
 */
function emailLayout({ title, eyebrow, contentHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f7fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #25283a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f6f7fb; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 14px; border: 1px solid #eceef3; box-shadow: 0 4px 18px rgba(37, 40, 58, 0.05); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 28px; background: linear-gradient(135deg, #7b5feb 0%, #5f42cb 100%); color: #ffffff;">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; color: #e0d7ff; display: block; margin-bottom: 4px;">${escapeHtml(eyebrow || 'TASKPILOT AI')}</span>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">${escapeHtml(title)}</h1>
                  </td>
                  <td align="right" valign="top" style="font-size: 22px;">✦</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 28px 28px 24px;">
              ${contentHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 16px 28px; background-color: #fafafc; border-top: 1px solid #eceef3; font-size: 11px; color: #9295a5; text-align: center;">
              Sent by <strong>TaskPilot AI</strong> • Personal Productivity Workspace<br>
              Timezone: Asia/Kolkata
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Custom Task Reminder Email Template
 */
export function buildTaskReminderEmail({ task, reminder, timeZone = 'Asia/Kolkata' }) {
  const safeTitle = escapeHtml(task.title);
  const safeNote = reminder.note ? escapeHtml(reminder.note) : '';
  const safeDesc = task.description ? escapeHtml(task.description) : '';
  const scheduledTimeStr = formatDateTime(reminder.scheduledAt, timeZone);
  const dueStr = task.dueDate ? formatDateTime(task.dueDate, timeZone) : 'No deadline';

  const priorityColors = {
    urgent: { bg: '#fff0f0', text: '#df474b', border: '#ffd2d3' },
    high: { bg: '#fff5eb', text: '#d97a38', border: '#ffe1cc' },
    medium: { bg: '#f1efff', text: '#674dd8', border: '#ddd5fe' },
    low: { bg: '#eff8f2', text: '#43936c', border: '#ccebd9' },
  };
  const color = priorityColors[task.priority] || priorityColors.medium;

  const contentHtml = `
    <div style="margin-bottom: 20px;">
      <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; background-color: ${color.bg}; color: ${color.text}; border: 1px solid ${color.border}; font-size: 11px; font-weight: 700; text-transform: uppercase;">
        ${escapeHtml(task.priority)} priority
      </span>
      <h2 style="font-size: 20px; font-weight: 700; color: #25283a; margin: 12px 0 8px;">${safeTitle}</h2>
      ${safeDesc ? `<p style="font-size: 13px; color: #696b7a; line-height: 1.5; margin: 0 0 16px;">${safeDesc}</p>` : ''}
    </div>

    ${safeNote ? `
      <div style="background-color: #f7f6fd; border-left: 3px solid #7359df; border-radius: 4px; padding: 12px 16px; margin-bottom: 20px;">
        <span style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #7359df; display: block; margin-bottom: 4px;">Reminder Note:</span>
        <p style="margin: 0; font-size: 13px; color: #3b3c4f; font-style: italic;">“${safeNote}”</p>
      </div>
    ` : ''}

    <table role="presentation" width="100%" style="border-collapse: collapse; margin-top: 16px; background-color: #fafafd; border-radius: 8px; border: 1px solid #eceef3;">
      <tr>
        <td style="padding: 10px 14px; font-size: 12px; color: #77798a; border-bottom: 1px solid #eceef3;">Scheduled for:</td>
        <td style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #25283a; border-bottom: 1px solid #eceef3;" align="right">${scheduledTimeStr}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-size: 12px; color: #77798a; border-bottom: 1px solid #eceef3;">Task deadline:</td>
        <td style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #25283a; border-bottom: 1px solid #eceef3;" align="right">${dueStr}</td>
      </tr>
      ${task.estimatedMinutes ? `
        <tr>
          <td style="padding: 10px 14px; font-size: 12px; color: #77798a;">Estimated time:</td>
          <td style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #25283a;" align="right">${task.estimatedMinutes} minutes</td>
        </tr>
      ` : ''}
    </table>
  `;

  const html = emailLayout({
    title: 'Task Reminder',
    eyebrow: 'YOUR SCHEDULED REMINDER',
    contentHtml,
  });

  const text = [
    `TASKPILOT AI — TASK REMINDER`,
    `=============================`,
    `Task: ${task.title}`,
    `Priority: ${task.priority.toUpperCase()}`,
    task.description ? `Description: ${task.description}` : null,
    reminder.note ? `Note: "${reminder.note}"` : null,
    `Scheduled: ${scheduledTimeStr}`,
    `Deadline: ${dueStr}`,
    task.estimatedMinutes ? `Estimated duration: ${task.estimatedMinutes} min` : null,
    ``,
    `Open your TaskPilot workspace to update or complete this task.`,
  ].filter(Boolean).join('\n');

  return {
    subject: `Reminder: ${task.title}`,
    html,
    text,
  };
}

/**
 * Deadline Notification Email Template
 */
export function buildDeadlineAlertEmail({ task, stage, timeZone = 'Asia/Kolkata' }) {
  const safeTitle = escapeHtml(task.title);
  const dueStr = formatDateTime(task.dueDate, timeZone);

  const stageHeaders = {
    upcoming: { title: 'Upcoming Deadline (24-48 Hours)', badge: 'UPCOMING DEADLINE', tone: '#5991d7' },
    approaching: { title: 'Deadline Approaching Soon (<24 Hours)', badge: 'URGENT ATTENTION', tone: '#d97a38' },
    overdue: { title: 'Task is Overdue', badge: 'OVERDUE TASK', tone: '#df474b' },
    high_priority_unfinished: { title: 'High Priority Task Needs Attention', badge: 'HIGH PRIORITY FOCUS', tone: '#e56d72' },
  };

  const stageMeta = stageHeaders[stage] || stageHeaders.approaching;

  const contentHtml = `
    <div style="margin-bottom: 18px;">
      <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; background-color: #fff2f2; color: ${stageMeta.tone}; border: 1px solid #ffd8d6; font-size: 11px; font-weight: 700;">
        ${stageMeta.badge}
      </span>
      <h2 style="font-size: 20px; font-weight: 700; color: #25283a; margin: 12px 0 8px;">${safeTitle}</h2>
      ${task.description ? `<p style="font-size: 13px; color: #696b7a; margin: 0 0 16px;">${escapeHtml(task.description)}</p>` : ''}
    </div>

    <table role="presentation" width="100%" style="border-collapse: collapse; background-color: #fafafd; border-radius: 8px; border: 1px solid #eceef3;">
      <tr>
        <td style="padding: 10px 14px; font-size: 12px; color: #77798a; border-bottom: 1px solid #eceef3;">Deadline:</td>
        <td style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: ${stage === 'overdue' ? '#df474b' : '#25283a'}; border-bottom: 1px solid #eceef3;" align="right">${dueStr}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-size: 12px; color: #77798a;">Priority:</td>
        <td style="padding: 10px 14px; font-size: 12px; font-weight: 600; text-transform: capitalize; color: #25283a;" align="right">${escapeHtml(task.priority)}</td>
      </tr>
      ${task.estimatedMinutes ? `
        <tr>
          <td style="padding: 10px 14px; font-size: 12px; color: #77798a; border-top: 1px solid #eceef3;">Estimated time:</td>
          <td style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #25283a; border-top: 1px solid #eceef3;" align="right">${task.estimatedMinutes} minutes</td>
        </tr>
      ` : ''}
    </table>
  `;

  const html = emailLayout({
    title: stageMeta.title,
    eyebrow: 'AUTOMATED DEADLINE ALERT',
    contentHtml,
  });

  const text = [
    `TASKPILOT AI — ${stageMeta.badge}`,
    `=============================`,
    `Task: ${task.title}`,
    `Status: ${task.status}`,
    `Deadline: ${dueStr}`,
    `Priority: ${task.priority.toUpperCase()}`,
    task.estimatedMinutes ? `Estimated duration: ${task.estimatedMinutes} min` : null,
  ].filter(Boolean).join('\n');

  return {
    subject: `[${stageMeta.badge}] ${task.title}`,
    html,
    text,
  };
}

/**
 * Morning Briefing Email Template
 */
export function buildMorningBriefingEmail({ dateStr, user, tasksDueToday, overdueTasks, highPriorityTasks, routineSummary, planSuggestions = [] }) {
  const contentHtml = `
    <p style="font-size: 14px; color: #55576a; margin: 0 0 20px;">
      Good morning, <strong>${escapeHtml(user.name)}</strong>! Here is your daily focus plan for <strong>${escapeHtml(dateStr)}</strong>.
    </p>

    <!-- Stat Pills -->
    <table role="presentation" width="100%" style="margin-bottom: 22px;">
      <tr>
        <td width="33%" style="padding: 8px; background: #f2efff; border-radius: 8px; text-align: center;">
          <div style="font-size: 20px; font-weight: 800; color: #674dd8;">${tasksDueToday.length}</div>
          <div style="font-size: 10px; color: #77798a; font-weight: 600; text-transform: uppercase;">Due Today</div>
        </td>
        <td width="4%"></td>
        <td width="33%" style="padding: 8px; background: #fff0f0; border-radius: 8px; text-align: center;">
          <div style="font-size: 20px; font-weight: 800; color: #df474b;">${overdueTasks.length}</div>
          <div style="font-size: 10px; color: #77798a; font-weight: 600; text-transform: uppercase;">Overdue</div>
        </td>
        <td width="4%"></td>
        <td width="33%" style="padding: 8px; background: #fff6e8; border-radius: 8px; text-align: center;">
          <div style="font-size: 20px; font-weight: 800; color: #dd9a41;">${routineSummary?.currentStreak || 0}d</div>
          <div style="font-size: 10px; color: #77798a; font-weight: 600; text-transform: uppercase;">Routine Streak</div>
        </td>
      </tr>
    </table>

    <!-- Today's Tasks -->
    <h3 style="font-size: 14px; font-weight: 700; color: #25283a; margin: 18px 0 10px; text-transform: uppercase; letter-spacing: 0.5px;">Today's Priority Tasks</h3>
    ${tasksDueToday.length ? `
      <ul style="padding-left: 20px; margin: 0 0 18px; color: #3b3c4f; font-size: 13px; line-height: 1.8;">
        ${tasksDueToday.map((t) => `<li><strong>${escapeHtml(t.title)}</strong> <span style="font-size: 11px; color: #85879a;">(${escapeHtml(t.priority)})</span></li>`).join('')}
      </ul>
    ` : '<p style="font-size: 12px; color: #9295a5; font-style: italic; margin-bottom: 18px;">No tasks specifically scheduled for today.</p>'}

    <!-- Overdue Tasks -->
    ${overdueTasks.length ? `
      <h3 style="font-size: 14px; font-weight: 700; color: #df474b; margin: 18px 0 10px; text-transform: uppercase; letter-spacing: 0.5px;">Requires Attention (Overdue)</h3>
      <ul style="padding-left: 20px; margin: 0 0 18px; color: #df474b; font-size: 13px; line-height: 1.8;">
        ${overdueTasks.map((t) => `<li><strong>${escapeHtml(t.title)}</strong></li>`).join('')}
      </ul>
    ` : ''}

    <!-- Suggested Time Blocks / Plan -->
    ${planSuggestions.length ? `
      <div style="background-color: #f8f6ff; border: 1px solid #e7deff; border-radius: 10px; padding: 16px; margin-top: 20px;">
        <h4 style="margin: 0 0 8px; font-size: 12px; color: #674dd8; text-transform: uppercase; letter-spacing: 0.8px;">✦ AI Suggested Schedule (Unconfirmed)</h4>
        <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #4b4668; line-height: 1.7;">
          ${planSuggestions.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
  `;

  return {
    subject: `Morning Briefing: Your Focus for ${dateStr}`,
    html: emailLayout({
      title: 'Daily Morning Briefing',
      eyebrow: 'YOUR PRODUCTIVITY PLAN',
      contentHtml,
    }),
    text: `Morning Briefing for ${dateStr} - ${tasksDueToday.length} due today, ${overdueTasks.length} overdue. Routine streak: ${routineSummary?.currentStreak || 0} days.`,
  };
}

/**
 * Evening Review Email Template
 */
export function buildEveningReviewEmail({ dateStr, user, completedToday, remainingTasks, routineStatus, streakInfo }) {
  const contentHtml = `
    <p style="font-size: 14px; color: #55576a; margin: 0 0 20px;">
      Good evening, <strong>${escapeHtml(user.name)}</strong>! Here is your daily completion recap for <strong>${escapeHtml(dateStr)}</strong>.
    </p>

    <!-- Completed Today -->
    <div style="background-color: #eff8f2; border: 1px solid #ccebd9; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 10px; font-size: 14px; font-weight: 700; color: #3b8761;">
        ✓ Completed Today (${completedToday.length})
      </h3>
      ${completedToday.length ? `
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #2c684a; line-height: 1.8;">
          ${completedToday.map((t) => `<li><strong>${escapeHtml(t.title)}</strong></li>`).join('')}
        </ul>
      ` : '<p style="margin: 0; font-size: 12px; color: #6b8f7b; font-style: italic;">No tasks completed today.</p>'}
    </div>

    <!-- Daily Routine Status -->
    <div style="background-color: #faf8ff; border: 1px solid #eee9ff; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 700; color: #674dd8;">
        Daily Routine Checklist
      </h3>
      <p style="margin: 0 0 10px; font-size: 12px; color: #64559e;">
        Completion: <strong>${routineStatus?.percent || 0}%</strong> of required habits.
        Current streak: <strong>${streakInfo?.currentStreak || 0} days</strong>.
      </p>
    </div>

    <!-- Remaining Tasks for Tomorrow -->
    <h3 style="font-size: 13px; font-weight: 700; color: #25283a; margin: 18px 0 10px; text-transform: uppercase; letter-spacing: 0.5px;">Pending Tasks</h3>
    ${remainingTasks.length ? `
      <ul style="padding-left: 20px; margin: 0; color: #55576a; font-size: 12px; line-height: 1.8;">
        ${remainingTasks.slice(0, 7).map((t) => `<li>${escapeHtml(t.title)} <span style="color: #9295a5;">(${escapeHtml(t.priority)})</span></li>`).join('')}
      </ul>
    ` : '<p style="font-size: 12px; color: #9295a5;">No active pending tasks.</p>'}
  `;

  return {
    subject: `Evening Review: ${completedToday.length} Tasks Completed on ${dateStr}`,
    html: emailLayout({
      title: 'Daily Evening Review',
      eyebrow: 'DAY IN REVIEW',
      contentHtml,
    }),
    text: `Evening Review for ${dateStr} - ${completedToday.length} tasks completed today. Routine streak: ${streakInfo?.currentStreak || 0} days.`,
  };
}

/**
 * Weekly Productivity Report Email Template
 */
export function buildWeeklyReportEmail({ user, periodLabel, completedCount, overdueCount, openCount, streakInfo, routineCompletionRate, priorities = [], improvements = [] }) {
  const contentHtml = `
    <p style="font-size: 14px; color: #55576a; margin: 0 0 20px;">
      Hello <strong>${escapeHtml(user.name)}</strong>! Here is your productivity summary for the week of <strong>${escapeHtml(periodLabel)}</strong>.
    </p>

    <!-- Weekly Highlights -->
    <table role="presentation" width="100%" style="margin-bottom: 22px;">
      <tr>
        <td width="33%" style="padding: 12px; background: #eff8f2; border-radius: 8px; text-align: center;">
          <div style="font-size: 22px; font-weight: 800; color: #3b8761;">${completedCount}</div>
          <div style="font-size: 10px; color: #6b8f7b; font-weight: 600; text-transform: uppercase;">Tasks Done</div>
        </td>
        <td width="4%"></td>
        <td width="33%" style="padding: 12px; background: #f2efff; border-radius: 8px; text-align: center;">
          <div style="font-size: 22px; font-weight: 800; color: #674dd8;">${routineCompletionRate}%</div>
          <div style="font-size: 10px; color: #7b6abf; font-weight: 600; text-transform: uppercase;">Habit Rate</div>
        </td>
        <td width="4%"></td>
        <td width="33%" style="padding: 12px; background: #fff6e8; border-radius: 8px; text-align: center;">
          <div style="font-size: 22px; font-weight: 800; color: #dd9a41;">${streakInfo?.currentStreak || 0}d</div>
          <div style="font-size: 10px; color: #9c7b41; font-weight: 600; text-transform: uppercase;">Best: ${streakInfo?.longestStreak || 0}d</div>
        </td>
      </tr>
    </table>

    <!-- Priorities for Ahead -->
    ${priorities.length ? `
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 13px; font-weight: 700; color: #25283a; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px;">Top Priorities For This Week</h3>
        <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #3b3c4f; line-height: 1.8;">
          ${priorities.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
        </ol>
      </div>
    ` : ''}

    <!-- Improvements -->
    ${improvements.length ? `
      <div style="background-color: #faf8ff; border: 1px solid #e7deff; border-radius: 10px; padding: 14px 18px;">
        <h4 style="margin: 0 0 8px; font-size: 12px; color: #674dd8; text-transform: uppercase;">✦ Recommended Adjustments</h4>
        <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #55576a; line-height: 1.7;">
          ${improvements.map((imp) => `<li>${escapeHtml(imp)}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
  `;

  return {
    subject: `Weekly Productivity Report (${periodLabel})`,
    html: emailLayout({
      title: 'Weekly Productivity Report',
      eyebrow: 'WEEKLY PERFORMANCE & HABITS',
      contentHtml,
    }),
    text: `Weekly Report for ${periodLabel} - ${completedCount} tasks completed, ${openCount} open tasks, routine completion rate: ${routineCompletionRate}%.`,
  };
}
