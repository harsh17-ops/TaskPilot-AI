import React from 'react';

/**
 * Alert banner for displaying errors or notifications.
 */
export function Notice({ children }) {
  return <div className="notice">{children}</div>;
}

export default Notice;
