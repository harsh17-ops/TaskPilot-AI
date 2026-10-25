import React, { useState } from 'react';
import { X, ArrowUpRight, Bell } from 'lucide-react';
import api from '../../api/client.js';

/**
 * Task Creation Modal Dialog
 * 
 * Supports configuring:
 * - title (required, max 160 chars)
 * - optional description
 * - priority (urgent, high, medium, low)
 * - due date (defaults to initialDate if provided from calendar click)
 * - estimated time in minutes (1 - 1440)
 * - optional instant email reminder scheduling
 */
export function TaskModal({ initialDate, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: initialDate || '',
    estimatedMinutes: '',
  });

  const [enableReminder, setEnableReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState(initialDate || new Date().toLocaleDateString('en-CA'));
  const [reminderTime, setReminderTime] = useState('09:00');
  const [reminderNote, setReminderNote] = useState('');

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const taskRes = await api.post('/tasks', {
        ...form,
        dueDate: form.dueDate ? new Date(`${form.dueDate}T12:00:00`).toISOString() : null,
        estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : null,
      });

      const createdTask = taskRes.data.task;

      // If user chose to schedule a reminder alongside creation
      if (enableReminder && createdTask?._id) {
        if (!reminderDate || !reminderTime) {
          throw new Error('Please specify both a date and time for the reminder.');
        }
        const scheduledDate = new Date(`${reminderDate}T${reminderTime}:00`);
        if (isNaN(scheduledDate.getTime())) {
          throw new Error('Invalid reminder date or time.');
        }
        if (scheduledDate.getTime() < Date.now() - 60000) {
          throw new Error('Reminder time must be in the future.');
        }

        await api.post('/reminders', {
          taskId: createdTask._id,
          scheduledAt: scheduledDate.toISOString(),
          note: reminderNote,
          timezone: 'Asia/Kolkata',
        });
      }

      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not save task.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">MAKE IT HAPPEN</div>
            <h2>New task</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <label>
          Task title
          <input
            autoFocus
            required
            maxLength={160}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Draft the project proposal"
          />
        </label>

        <label>
          Description <span className="optional">Optional</span>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Add a few helpful details…"
          />
        </label>

        <div className="form-columns">
          <label>
            Priority
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              {['urgent', 'high', 'medium', 'low'].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label>
            Due date
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => {
                setForm({ ...form, dueDate: e.target.value });
                if (!enableReminder) {
                  setReminderDate(e.target.value);
                }
              }}
            />
          </label>
        </div>

        <label>
          Estimated minutes <span className="optional">Optional</span>
          <input
            type="number"
            min={1}
            max={1440}
            value={form.estimatedMinutes}
            onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })}
            placeholder="30"
          />
        </label>

        {/* Optional Reminder Section */}
        <div style={{ marginTop: '4px', borderTop: '1px solid var(--line)', paddingTop: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enableReminder}
              onChange={(e) => setEnableReminder(e.target.checked)}
              style={{ width: 'auto', margin: 0 }}
            />
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bell size={13} style={{ color: '#7055d7' }} />
              Schedule email reminder for this task
            </span>
          </label>

          {enableReminder && (
            <div className="reminder-form-box" style={{ marginTop: '10px' }}>
              <div className="form-columns">
                <label>
                  Reminder Date
                  <input
                    type="date"
                    required
                    min={new Date().toLocaleDateString('en-CA')}
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                  />
                </label>

                <label>
                  Reminder Time
                  <input
                    type="time"
                    required
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                  />
                </label>
              </div>

              <label>
                Reminder note <span className="optional">Optional</span>
                <input
                  placeholder="e.g. Focus on this before lunch"
                  value={reminderNote}
                  maxLength={160}
                  onChange={(e) => setReminderNote(e.target.value)}
                />
              </label>
            </div>
          )}
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-btn" disabled={busy}>
            {busy ? 'Saving…' : 'Create task'}
            <ArrowUpRight size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}

export default TaskModal;
