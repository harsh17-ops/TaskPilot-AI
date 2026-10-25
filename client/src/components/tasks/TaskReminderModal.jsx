import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  Calendar,
  Clock,
  Check,
  AlertCircle,
  Trash2,
  Edit3,
  Plus,
  RefreshCw,
} from 'lucide-react';
import api from '../../api/client.js';

/**
 * Task Reminder Modal Component
 * 
 * Allows users to:
 * - View all existing reminders for a task with live delivery status
 * - Schedule new email reminders with custom date, time, and optional notes
 * - Edit / reschedule existing reminders
 * - Cancel active reminders
 * - View failure reasons and retry states
 */
export function TaskReminderModal({ task, onClose, onUpdated }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState(null);
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formNote, setFormNote] = useState('');

  const todayStr = new Date().toLocaleDateString('en-CA');

  // Load reminders on mount
  useEffect(() => {
    loadReminders();
    initDefaultForm();
  }, [task._id]);

  function initDefaultForm() {
    setEditingId(null);
    setFormNote('');
    // Default date: task's due date or today
    if (task.dueDate) {
      setFormDate(new Date(task.dueDate).toLocaleDateString('en-CA'));
    } else {
      setFormDate(todayStr);
    }
    // Default time: next full hour
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1);
    nextHour.setMinutes(0);
    const timeStr = `${String(nextHour.getHours()).padStart(2, '0')}:${String(
      nextHour.getMinutes()
    ).padStart(2, '0')}`;
    setFormTime(timeStr);
  }

  async function loadReminders() {
    setLoading(true);
    try {
      const res = await api.get(`/reminders/task/${task._id}`);
      setReminders(res.data.reminders || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load reminders.');
    } finally {
      setLoading(false);
    }
  }

  function handleStartEdit(rem) {
    setEditingId(rem._id);
    const d = new Date(rem.scheduledAt);
    setFormDate(d.toLocaleDateString('en-CA'));
    setFormTime(
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
        2,
        '0'
      )}`
    );
    setFormNote(rem.note || '');
    setError('');
    setSuccessMsg('');
  }

  function handleCancelEdit() {
    initDefaultForm();
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!formDate || !formTime) {
      setError('Please choose both a date and a time for your reminder.');
      return;
    }

    // Combine date and time
    const combinedDate = new Date(`${formDate}T${formTime}:00`);
    if (isNaN(combinedDate.getTime())) {
      setError('Invalid date or time.');
      return;
    }

    // Disallow scheduling in the past (allow 60s grace)
    if (combinedDate.getTime() < Date.now() - 60000) {
      setError('Please select a future time for your reminder.');
      return;
    }

    setBusy(true);
    try {
      if (editingId) {
        await api.patch(`/reminders/${editingId}`, {
          scheduledAt: combinedDate.toISOString(),
          note: formNote,
        });
        setSuccessMsg('Reminder rescheduled successfully.');
      } else {
        await api.post('/reminders', {
          taskId: task._id,
          scheduledAt: combinedDate.toISOString(),
          note: formNote,
          timezone: 'Asia/Kolkata',
        });
        setSuccessMsg('Reminder scheduled successfully.');
      }

      initDefaultForm();
      await loadReminders();
      onUpdated?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save reminder.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelReminder(reminderId) {
    if (!window.confirm('Cancel this reminder?')) return;
    try {
      await api.delete(`/reminders/${reminderId}`);
      await loadReminders();
      onUpdated?.();
      setSuccessMsg('Reminder cancelled.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not cancel reminder.');
    }
  }

  function formatDateTime(dateVal) {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  function getStatusBadge(rem) {
    switch (rem.status) {
      case 'pending':
        return (
          <span className="reminder-status-pill status-pending" title="Scheduled and waiting to send">
            <Clock size={11} /> Scheduled
          </span>
        );
      case 'processing':
        return (
          <span className="reminder-status-pill status-processing" title="Currently being delivered">
            <RefreshCw size={11} className="spin" /> Delivering…
          </span>
        );
      case 'sent':
        return (
          <span className="reminder-status-pill status-sent" title={`Sent at ${formatDateTime(rem.sentAt)}`}>
            <Check size={11} /> Delivered
          </span>
        );
      case 'cancelled':
        return (
          <span className="reminder-status-pill status-cancelled">Cancelled</span>
        );
      case 'failed':
        return (
          <span className="reminder-status-pill status-failed" title={rem.lastError || 'Failed to deliver'}>
            <AlertCircle size={11} /> Failed
          </span>
        );
      default:
        return <span className="reminder-status-pill">{rem.status}</span>;
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal reminder-modal">
        {/* Header */}
        <div className="modal-head">
          <div>
            <div className="eyebrow">AUTOMATED REMINDERS</div>
            <h2>Task Reminders</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Task Summary Banner */}
        <div className="reminder-task-banner">
          <div className="reminder-task-info">
            <b>{task.title}</b>
            <div className="reminder-task-meta">
              <span className={`priority-dot ${task.priority}`} />
              <span className="meta-text">{task.priority}</span>
              {task.dueDate && (
                <span className="meta-text due-text">
                  <Calendar size={11} />
                  Due: {formatDateTime(task.dueDate)}
                </span>
              )}
            </div>
          </div>
          <span className={`status-chip ${task.status}`}>{task.status}</span>
        </div>

        {error && <div className="form-error">{error}</div>}
        {successMsg && <div className="success-note">{successMsg}</div>}

        {/* Existing Reminders Section */}
        <div className="reminders-section">
          <div className="section-title">
            <Bell size={14} />
            <b>Existing reminders ({reminders.length})</b>
          </div>

          {loading ? (
            <div className="reminders-loading">Loading reminders…</div>
          ) : reminders.length ? (
            <div className="reminders-list">
              {reminders.map((rem) => (
                <div className={`reminder-card ${rem.status}`} key={rem._id}>
                  <div className="reminder-card-main">
                    <div className="reminder-time-row">
                      <Clock size={13} className="time-icon" />
                      <strong>{formatDateTime(rem.scheduledAt)}</strong>
                      {getStatusBadge(rem)}
                    </div>

                    {rem.note && (
                      <div className="reminder-note-text">
                        “{rem.note}”
                      </div>
                    )}

                    {rem.status === 'sent' && rem.sentAt && (
                      <div className="reminder-delivery-meta">
                        Delivered on {formatDateTime(rem.sentAt)}
                      </div>
                    )}

                    {rem.status === 'failed' && (
                      <div className="reminder-error-meta">
                        {rem.lastError || 'Delivery attempt failed'}
                        {rem.nextAttemptAt && ` • Retrying at ${formatDateTime(rem.nextAttemptAt)}`}
                      </div>
                    )}
                  </div>

                  {rem.status !== 'sent' && rem.status !== 'cancelled' && (
                    <div className="reminder-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        title="Edit reminder"
                        onClick={() => handleStartEdit(rem)}
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn text-danger"
                        title="Cancel reminder"
                        onClick={() => handleCancelReminder(rem._id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="reminders-empty">
              <p>No reminders scheduled for this task yet.</p>
              <small>Set a date and time below to receive an email alert.</small>
            </div>
          )}
        </div>

        {/* Schedule / Edit Form */}
        <form className="reminder-form-box" onSubmit={handleSubmit}>
          <div className="form-box-head">
            <b>{editingId ? 'Edit Reminder' : 'Set New Reminder'}</b>
            {editingId && (
              <button
                type="button"
                className="text-button"
                onClick={handleCancelEdit}
              >
                Cancel edit
              </button>
            )}
          </div>

          <div className="form-columns">
            <label>
              Date
              <input
                type="date"
                required
                min={todayStr}
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </label>

            <label>
              Time
              <input
                type="time"
                required
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
              />
            </label>
          </div>

          <label>
            Reminder note <span className="optional">Optional</span>
            <input
              placeholder="e.g. Check client slides before call"
              value={formNote}
              maxLength={200}
              onChange={(e) => setFormNote(e.target.value)}
            />
          </label>

          <div className="timezone-hint">
            <span>Timezone: <strong>Asia/Kolkata</strong></span>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>
              Close
            </button>
            <button className="primary-btn" disabled={busy}>
              {busy ? (
                'Saving…'
              ) : editingId ? (
                <>
                  <Check size={14} /> Update reminder
                </>
              ) : (
                <>
                  <Plus size={14} /> Set reminder
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TaskReminderModal;
