import React, { useState } from 'react';
import { Plus, ArrowUpRight } from 'lucide-react';
import api from '../../api/client.js';

/**
 * Inline single-line quick capture form for adding tasks immediately.
 */
export function QuickAdd({ onAdded }) {
  const [title, setTitle] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await api.post('/tasks', { title: title.trim() });
    setTitle('');
    onAdded?.();
  }

  return (
    <form className="quick-add" onSubmit={submit}>
      <span className="plus-outline">
        <Plus size={16} />
      </span>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs to get done?"
      />
      <button disabled={!title.trim()}>
        Add task <ArrowUpRight size={14} />
      </button>
    </form>
  );
}

export default QuickAdd;
