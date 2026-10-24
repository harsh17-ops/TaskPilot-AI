import React from 'react';

/**
 * Animated skeleton placeholder cards shown during data loading.
 */
export function Skeleton() {
  return (
    <div className="stat-grid">
      {[1, 2, 3, 4].map((x) => (
        <div className="stat-card skeleton" key={x} />
      ))}
    </div>
  );
}

export default Skeleton;
