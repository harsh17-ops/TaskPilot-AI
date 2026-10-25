import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  CheckSquare,
  Inbox,
  Clock,
  Flame,
  Plus,
  Repeat2,
  ArrowUpRight,
} from 'lucide-react';
import useLoad from '../hooks/useLoad.js';
import Heading from '../components/common/Heading.jsx';
import Stat from '../components/common/Stat.jsx';
import Notice from '../components/common/Notice.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import Empty from '../components/common/Empty.jsx';
import QuickAdd from '../components/common/QuickAdd.jsx';
import TaskRow from '../components/tasks/TaskRow.jsx';
import TaskReminderModal from '../components/tasks/TaskReminderModal.jsx';

/**
 * Overview / Dashboard Page
 * 
 * Aggregates high-priority data:
 * - Productivity metrics (due today, active tasks, overdue, routine streak)
 * - Recently active tasks list
 * - Daily routine completion progress widget
 * - Quick-add capture input
 * - AI assistant focus banner
 */
export function Overview({ user, refresh, onAdd }) {
  const { data, error, busy, reload } = useLoad('/analytics/summary', refresh);
  const [reminderTask, setReminderTask] = useState(null);

  const now = new Date();
  const currentHour = now.getHours();
  const greeting =
    currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';
  const formattedDate = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const recentTasks = data?.recentTasks || [];

  return (
    <>
      <Heading
        eyebrow={formattedDate.toUpperCase()}
        title={`${greeting}, ${user.name.split(' ')[0]} 👋`}
        sub="Here’s your focus for today."
        action={
          <button type="button" className="primary-btn" onClick={onAdd}>
            <Plus size={17} /> New task
          </button>
        }
      />

      {error && <Notice>{error}</Notice>}

      {busy ? (
        <Skeleton />
      ) : (
        <>
          {/* Key Productivity Metrics */}
          <div className="stat-grid">
            <Stat
              label="Due today"
              value={data.dueToday}
              note={`${data.completedToday} completed today`}
              icon={CheckSquare}
            />
            <Stat
              label="Active tasks"
              value={data.activeTasks}
              note="Across your workspace"
              icon={Inbox}
              tone="blue"
            />
            <Stat
              label="Overdue"
              value={data.overdue}
              note={data.overdue ? 'Needs your attention' : 'You’re all caught up'}
              icon={Clock}
              tone="rose"
            />
            <Stat
              label="Routine streak"
              value={`${data.streaks?.currentStreak || 0} days`}
              note={`Best: ${data.streaks?.longestStreak || 0} days`}
              icon={Flame}
              tone="amber"
            />
          </div>

          {/* Radar Tasks & Routine Progress */}
          <div className="dashboard-grid">
            <div className="panel task-panel">
              <div className="panel-head">
                <div>
                  <h3>On your radar</h3>
                  <p>Recently updated tasks</p>
                </div>
                <NavLink to="/tasks" className="text-link">
                  All tasks <ArrowUpRight size={14} />
                </NavLink>
              </div>

              {recentTasks.length ? (
                recentTasks.map((t) => (
                  <TaskRow
                    key={t._id}
                    task={t}
                    onChange={reload}
                    onOpenReminder={(task) => setReminderTask(task)}
                  />
                ))
              ) : (
                <Empty
                  title="A clear runway"
                  text="Add a task to get your day moving."
                  action={onAdd}
                />
              )}
            </div>

            <div className="panel routine-panel">
              <div className="panel-head">
                <div>
                  <h3>Daily routine</h3>
                  <p>Consistency starts with small steps</p>
                </div>
                <span className="routine-symbol">
                  <Repeat2 size={18} />
                </span>
              </div>

              <div className="routine-progress">
                <strong>{data.routinePercent}%</strong>
                <span>of required habits complete</span>
              </div>

              <div className="progress-track">
                <i style={{ width: `${data.routinePercent}%` }} />
              </div>

              <div className="routine-card-bottom">
                <div className="streak-avatar">
                  <Flame size={18} />
                </div>
                <div>
                  <b>{data.streaks?.currentStreak || 0} day streak</b>
                  <small>Measured only by your routine</small>
                </div>
                <NavLink to="/routine" aria-label="Open routine">
                  <ArrowUpRight size={17} />
                </NavLink>
              </div>

              <div className="routine-quote">
                “Small steps every day add up to big change.”
              </div>
            </div>
          </div>

          {/* Quick Capture & AI Plan Banner */}
          <div className="bottom-grid">
            <div className="panel quick-panel">
              <div className="panel-head">
                <div>
                  <h3>Quick capture</h3>
                  <p>Get it out of your head and onto your list</p>
                </div>
              </div>
              <QuickAdd onAdded={() => reload()} />
            </div>

            <div className="focus-banner">
              <div className="focus-decor">✦</div>
              <div className="eyebrow">A MOMENT OF FOCUS</div>
              <h3>
                One thing at a time.
                <br />
                You’re making progress.
              </h3>
              <NavLink to="/assistant">
                Plan your day <ArrowUpRight size={15} />
              </NavLink>
            </div>
          </div>

          {/* Reminder Modal */}
          {reminderTask && (
            <TaskReminderModal
              task={reminderTask}
              onClose={() => setReminderTask(null)}
              onUpdated={reload}
            />
          )}
        </>
      )}
    </>
  );
}

export default Overview;
