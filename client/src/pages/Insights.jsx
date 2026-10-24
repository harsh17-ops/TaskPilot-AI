import React from 'react';
import { Plus, Check, Clock, Flame } from 'lucide-react';
import useLoad from '../hooks/useLoad.js';
import Heading from '../components/common/Heading.jsx';
import Stat from '../components/common/Stat.jsx';

/**
 * Insights Page Component
 * 
 * Visualizes personal productivity analytics:
 * - Summary statistics (tasks created, completed today, overdue, routine streak)
 * - 7-day daily activity bar chart (tasks created vs. tasks completed)
 * - Task distribution breakdown across priority levels (urgent, high, medium, low)
 */
export function Insights() {
  const { data: summary } = useLoad('/analytics/summary');
  const { data: chart } = useLoad('/analytics/tasks');

  const priorityTotalCount =
    chart?.priority?.reduce((acc, curr) => acc + curr.value, 0) || 0;

  return (
    <>
      <Heading
        eyebrow="YOUR PROGRESS, AT A GLANCE"
        title="Insights"
        sub="Real activity from your tasks and routine history."
      />

      {/* Metrics Row */}
      <div className="stat-grid">
        <Stat
          label="Tasks created"
          value={summary?.tasksTotal || 0}
          note="Total in your workspace"
          icon={Plus}
        />
        <Stat
          label="Completed today"
          value={summary?.completedToday || 0}
          note="Normal task completion"
          icon={Check}
          tone="blue"
        />
        <Stat
          label="Overdue tasks"
          value={summary?.overdue || 0}
          note="Open tasks past due"
          icon={Clock}
          tone="rose"
        />
        <Stat
          label="Routine streak"
          value={`${summary?.streaks?.currentStreak || 0} days`}
          note={`Longest: ${summary?.streaks?.longestStreak || 0} days`}
          icon={Flame}
          tone="amber"
        />
      </div>

      {/* Charts Grid */}
      <div className="insight-grid">
        {/* 7-Day Activity Chart */}
        <div className="panel chart-panel">
          <div className="panel-head">
            <div>
              <h3>Task activity</h3>
              <p>Created and completed per day · past 7 days</p>
            </div>
          </div>

          <div className="chart-bars">
            {chart?.daily?.map((d) => (
              <div className="chart-column" key={d.date}>
                <div className="bars">
                  <i
                    style={{ height: `${Math.max(5, d.created * 20)}px` }}
                    title={`${d.created} created`}
                  />
                  <b
                    style={{ height: `${Math.max(5, d.completed * 20)}px` }}
                    title={`${d.completed} completed`}
                  />
                </div>
                <small>
                  {new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, {
                    weekday: 'short',
                  })}
                </small>
              </div>
            ))}
          </div>

          <div className="chart-legend">
            <span>
              <i />
              Created
            </span>
            <span>
              <i />
              Completed
            </span>
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="panel chart-panel">
          <div className="panel-head">
            <div>
              <h3>Priority distribution</h3>
              <p>Your task list by priority</p>
            </div>
          </div>

          {chart?.priority?.map((p) => {
            const percentage = priorityTotalCount
              ? (p.value / priorityTotalCount) * 100
              : 0;

            return (
              <div className="priority-stat" key={p.name}>
                <span className={`priority-dot ${p.name}`} />
                <span>{p.name}</span>
                <div className="priority-track">
                  <i className={p.name} style={{ width: `${percentage}%` }} />
                </div>
                <b>{p.value}</b>
              </div>
            );
          })}

          <p className="chart-footnote">
            Routine streaks are based on required routine items only.
          </p>
        </div>
      </div>
    </>
  );
}

export default Insights;
