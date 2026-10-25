import React, { useState, useEffect } from 'react';
import { CheckSquare, Plus, Trash2 } from 'lucide-react';
import api from '../api/client.js';
import useLoad from '../hooks/useLoad.js';
import Heading from '../components/common/Heading.jsx';
import Notice from '../components/common/Notice.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import Empty from '../components/common/Empty.jsx';
import TaskRow from '../components/tasks/TaskRow.jsx';
import TaskReminderModal from '../components/tasks/TaskReminderModal.jsx';

/**
 * Tasks Page Component
 * Serves both the complete tasks view ('/tasks') and the daily to-do view ('/today').
 * Supports searching, status filtering, priority filtering, task deletion, and scheduling reminders.
 */
export function Tasks({ refresh, onAdd, today = false }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [reminderTask, setReminderTask] = useState(null);

  const queryParams = new URLSearchParams();
  if (search) queryParams.set('search', search);
  if (status) queryParams.set('status', status);
  if (priority) queryParams.set('priority', priority);
  if (today) queryParams.set('date', new Date().toLocaleDateString('en-CA'));

  const { data, error, busy, reload } = useLoad(
    `/tasks?${queryParams.toString()}`,
    refresh
  );

  // Listen to the global search event dispatched by the topbar search input
  useEffect(() => {
    const handleSearchEvent = (e) => setSearch(e.detail);
    window.addEventListener('search', handleSearchEvent);
    return () => window.removeEventListener('search', handleSearchEvent);
  }, []);

  // Auto-reload when tasks are created or modified via voice assistant
  useEffect(() => {
    const handleTaskUpdated = () => reload();
    window.addEventListener('task-updated', handleTaskUpdated);
    return () => window.removeEventListener('task-updated', handleTaskUpdated);
  }, [reload]);

  async function handleDeleteTask(taskId) {
    if (!window.confirm('Delete this task?')) return;
    await api.delete(`/tasks/${taskId}`);
    reload();
  }

  const tasksList = data?.tasks || [];

  return (
    <>
      <Heading
        eyebrow={today ? 'DAILY FOCUS' : 'YOUR WORKSPACE'}
        title={today ? 'Today’s to-do' : 'My tasks'}
        sub={
          today
            ? 'A clear list for the day ahead.'
            : 'Everything you need to move forward.'
        }
        action={
          <button type="button" className="primary-btn" onClick={onAdd}>
            <Plus size={17} /> New task
          </button>
        }
      />

      {/* Filter and Count Bar */}
      <div className="filter-bar">
        <div className="filter-title">
          <CheckSquare size={17} />
          <b>{today ? 'Today’s tasks' : 'All tasks'}</b>
          <span className="count-pill">{tasksList.length}</span>
        </div>

        <div className="filters">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select>

          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">All priorities</option>
            {['urgent', 'high', 'medium', 'low'].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <Notice>{error}</Notice>}

      {/* Tasks List Panel */}
      <div className="panel tasks-list">
        {busy ? (
          <Skeleton />
        ) : tasksList.length ? (
          tasksList.map((task) => (
            <div className="task-row-wrap" key={task._id}>
              <TaskRow
                task={task}
                onChange={reload}
                onOpenReminder={(t) => setReminderTask(t)}
              />
              <button
                type="button"
                className="icon-btn delete-task"
                title="Delete task"
                onClick={() => handleDeleteTask(task._id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))
        ) : (
          <Empty
            title={search ? 'No matching tasks' : 'Nothing on your list yet'}
            text={
              search
                ? 'Try a different search or clear the filters.'
                : 'Capture a task and make a little progress.'
            }
            action={onAdd}
          />
        )}
      </div>

      {/* Task Reminder Modal */}
      {reminderTask && (
        <TaskReminderModal
          task={reminderTask}
          onClose={() => setReminderTask(null)}
          onUpdated={reload}
        />
      )}
    </>
  );
}

export default Tasks;
