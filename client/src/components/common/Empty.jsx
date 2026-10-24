import React from 'react';
import { Inbox, Plus } from 'lucide-react';

/**
 * Empty state placeholder with an icon, title, description, and an optional call-to-action button.
 */
export function Empty({ title, text, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Inbox size={19} />
      </div>
      <b>{title}</b>
      <span>{text}</span>
      {action && (
        <button onClick={action}>
          Create a task <Plus size={14} />
        </button>
      )}
    </div>
  );
}

export default Empty;
