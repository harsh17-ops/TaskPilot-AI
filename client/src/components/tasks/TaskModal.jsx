import React, { useState } from 'react';
import { X, ArrowUpRight } from 'lucide-react';
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
 */
export function TaskModal({ initialDate, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: initialDate || '',
    estimatedMinutes: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      await api.post('/tasks', {
        ...form,
        dueDate: form.dueDate ? new Date(`${form.dueDate}T12:00:00`).toISOString() : null,
        estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : null,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save task.');
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
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
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
