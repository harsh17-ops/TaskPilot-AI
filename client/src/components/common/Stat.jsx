import React from 'react';

/**
 * Metric card displaying a key number, label, contextual note, and an icon with a color tone.
 */
export function Stat({ label, value, note, icon: Icon, tone = 'violet' }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <div className={`stat-icon ${tone}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </div>
  );
}

export default Stat;
