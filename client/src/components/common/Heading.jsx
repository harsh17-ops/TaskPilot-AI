import React from 'react';

/**
 * Standard page heading with eyebrow badge, main title, subtitle, and optional right-aligned action button.
 */
export function Heading({ eyebrow, title, sub, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export default Heading;
