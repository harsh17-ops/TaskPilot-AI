/**
 * Date Utility Functions
 */

/**
 * Shifts a 'YYYY-MM-DD' calendar date string by a number of days (+/- delta).
 * Uses midday (12:00:00) to ensure daylight savings or localized offsets do not cause day drift.
 * 
 * @param {string} date - Date string in 'YYYY-MM-DD'
 * @param {number} delta - Positive or negative number of days to shift
 * @returns {string} Resulting date string in 'YYYY-MM-DD'
 */
export function shiftDate(date, delta) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString('en-CA');
}
