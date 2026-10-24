import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Check,
  Plus,
  ArrowUpRight,
} from 'lucide-react';
import api from '../api/client.js';
import useLoad from '../hooks/useLoad.js';
import { shiftDate } from '../utils/dateUtils.js';
import Heading from '../components/common/Heading.jsx';
import Notice from '../components/common/Notice.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import Empty from '../components/common/Empty.jsx';

/**
 * Daily Routine Page
 * 
 * Features:
 * - Date-addressable snapshot viewing and checklist completion
 * - Real-time streak tracking (current streak, longest streak, today status)
 * - Habit template management (add, rename, activate/deactivate)
 * 
 * Key Concept:
 * Streaks are derived strictly from routine checklist history.
 * Editing habit templates affects future snapshots without mutating past records.
 */
export function Routine() {
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [newTitle, setNewTitle] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [error, setError] = useState('');

  const { data, busy, reload } = useLoad(`/routines/day?date=${date}`, refreshTrigger);
  const routinesList = useLoad('/routines', refreshTrigger);

  async function toggleRoutineItem(item) {
    try {
      await api.patch(`/routines/day/${item.routineId}`, {
        date,
        completed: !item.completed,
      });
      reload();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save completion.');
    }
  }

  async function handleAddHabit(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await api.post('/routines', { title: newTitle.trim() });
    setNewTitle('');
    setRefreshTrigger((prev) => prev + 1);
  }

  async function handleEditRoutine(r) {
    const title = window.prompt('Edit routine item', r.title);
    if (title?.trim()) {
      await api.patch(`/routines/${r._id}`, { title: title.trim() });
      setRefreshTrigger((prev) => prev + 1);
    }
  }

  async function handleToggleActive(r) {
    await api.patch(`/routines/${r._id}`, { isActive: !r.isActive });
    setRefreshTrigger((prev) => prev + 1);
  }

  const daySnapshot = data?.day;
  const requiredItems = daySnapshot?.items?.filter((i) => i.isRequired) || [];
  const completedRequiredCount = requiredItems.filter((i) => i.completed).length;
  const completionPercentage = requiredItems.length
    ? Math.round((completedRequiredCount / requiredItems.length) * 100)
    : 0;

  return (
    <>
      <Heading
        eyebrow="SHOW UP FOR YOURSELF"
        title="Daily routine"
        sub="Your streak measures your routine consistency, never your task list."
        action={
          <div className="date-control">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setDate(shiftDate(date, -1))}
            >
              <ChevronLeft size={17} />
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <button
              type="button"
              className="icon-btn"
              onClick={() => setDate(shiftDate(date, 1))}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        }
      />

      {error && <Notice>{error}</Notice>}

      {/* Routine Streaks & Daily Progress */}
      <div className="routine-stats">
        <div className="panel streak-main">
          <div className="streak-graphic">
            <div>
              <Flame size={29} />
            </div>
          </div>
          <div>
            <div className="eyebrow">CURRENT STREAK</div>
            <strong>
              {data?.streaks?.currentStreak || 0}
              <span> days</span>
            </strong>
            <p>Longest streak: {data?.streaks?.longestStreak || 0} days</p>
          </div>
          <div className="streak-status">
            {data?.streaks?.todayComplete
              ? 'Today complete'
              : completionPercentage
              ? `${completionPercentage}% so far`
              : 'Today in progress'}
          </div>
        </div>

        <div className="panel routine-today-stat">
          <div className="eyebrow">TODAY’S PROGRESS</div>
          <div className="routine-big-number">
            {completionPercentage}
            <small>%</small>
          </div>
          <div className="progress-track">
            <i style={{ width: `${completionPercentage}%` }} />
          </div>
          <p>
            {completedRequiredCount} of {requiredItems.length} required habits done
          </p>
        </div>
      </div>

      {/* Checklist Snapshot Panel */}
      <div className="panel checklist-panel">
        <div className="panel-head">
          <div>
            <h3>Your checklist</h3>
            <p>
              {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}{' '}
              · Snapshotted for this date
            </p>
          </div>
          <span className="count-pill">
            {completedRequiredCount}/{requiredItems.length}
          </span>
        </div>

        {busy ? (
          <Skeleton />
        ) : daySnapshot?.items?.length ? (
          daySnapshot.items.map((item) => (
            <div
              className={`routine-item ${item.completed ? 'routine-done' : ''}`}
              key={item.routineId}
            >
              <button
                type="button"
                className={`check-circle ${item.completed ? 'checked' : ''}`}
                onClick={() => toggleRoutineItem(item)}
              >
                {item.completed && <Check size={13} />}
              </button>
              <div className="routine-item-title">
                <b>{item.title}</b>
                {item.isRequired ? (
                  <small>Required for streak</small>
                ) : (
                  <small>Optional</small>
                )}
              </div>
              {item.completed && <span className="done-badge">Completed</span>}
            </div>
          ))
        ) : (
          <Empty
            title="A rest day"
            text="No required habits are scheduled for this date."
          />
        )}
      </div>

      {/* Habit Templates Management */}
      <div className="panel manage-routines">
        <div className="panel-head">
          <div>
            <h3>Manage your routine</h3>
            <p>Edit the habits that shape your daily checklist.</p>
          </div>
        </div>

        <form className="quick-add" onSubmit={handleAddHabit}>
          <span className="plus-outline">
            <Plus size={16} />
          </span>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a new routine habit…"
          />
          <button disabled={!newTitle.trim()}>
            Add habit <ArrowUpRight size={14} />
          </button>
        </form>

        {routinesList.data?.routines?.map((r) => (
          <div
            className={`routine-manage-row ${!r.isActive ? 'inactive' : ''}`}
            key={r._id}
          >
            <div className="priority-dot medium" />
            <span>{r.title}</span>
            <small>{r.isRequired ? 'Required' : 'Optional'}</small>
            <button
              type="button"
              className="text-button"
              onClick={() => handleEditRoutine(r)}
            >
              Edit
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => handleToggleActive(r)}
            >
              {r.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

export default Routine;
