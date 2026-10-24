import React from 'react';
import { Check, Clock } from 'lucide-react';
import api from '../../api/client.js';

/**
 * Individual task row component.
 * Allows toggling between 'completed' and 'todo' statuses, displays priority indicator,
 * and renders formatted deadline if one is assigned.
 */
export function TaskRow({ task, onChange }) {
  const isDone = task.status === 'completed';

  async function toggleStatus() {
    await api.patch(`/tasks/${task._id}`, {
      status: isDone ? 'todo' : 'completed',
    });
    onChange?.();
  }

  return (
    <div className={`task-row ${isDone ? 'done' : ''}`}>
      <button
        type="button"
        className={`check-circle ${isDone ? 'checked' : ''}`}
        onClick={toggleStatus}
        title="Toggle completion"
      >
        {isDone && <Check size={13} />}
      </button>
      <div className="task-row-copy">
        <b>{task.title}</b>
        {task.description && <small>{task.description}</small>}
      </div>
      <span className={`priority-dot ${task.priority}`} />
      <span className="priority-label">{task.priority}</span>
      {task.dueDate && (
        <span className="due-label">
          <Clock size={12} />
          {new Date(task.dueDate).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      )}
    </div>
  );
}

export default TaskRow;
