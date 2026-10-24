/**
 * Streak Calculation Service
 * 
 * Core Business Rules:
 * 1. Routine-Only: Routine streaks are measured strictly from daily routine checklists.
 *    Ad-hoc task completion never affects routine streaks.
 * 2. Eligibility & Success:
 *    A date is successful if:
 *    - The day snapshot is eligible (day.eligible === true)
 *    - It contains at least one required routine item
 *    - ALL required items for that date are marked completed
 *    Optional items (isRequired === false) never block a streak.
 * 3. Pending Today Rule:
 *    If today's routine is not yet completed, it does NOT break yesterday's streak.
 *    The user still has time before the cutoff to complete today's habits.
 * 4. Midday UTC Arithmetic:
 *    Date steps use midday (12:00:00Z) to prevent daylight savings shifts or
 *    timezone roll-overs from skewing calendar day calculations.
 */

/**
 * Calculates current streak, longest historical streak, and today's completion status.
 *
 * @param {Array<Object>} days - Array of RoutineDay snapshot records from MongoDB.
 * @param {string} today - The user's current local date in 'YYYY-MM-DD' format.
 * @param {boolean} [cutoffReached=false] - Whether the day's cutoff hour has passed.
 * @returns {{ currentStreak: number, longestStreak: number, todayComplete: boolean }}
 */
export function calculateStreaks(days, today, cutoffReached = false) {
  // Map day snapshots by localDate string for fast O(1) lookup
  const dayByDate = new Map(days.map((day) => [day.localDate, day]));

  /**
   * Evaluates if a given date met all required routine criteria.
   */
  const isDateSuccessful = (dateStr) => {
    const dayRecord = dayByDate.get(dateStr);
    if (!dayRecord || !dayRecord.eligible) {
      return false;
    }

    const requiredItems = dayRecord.items.filter((item) => item.isRequired);
    if (requiredItems.length === 0) {
      return false; // Days with zero required items cannot count as a streak
    }

    return requiredItems.every((item) => item.completed);
  };

  /**
   * Helper: compute the previous calendar date string in YYYY-MM-DD.
   * Uses midday UTC to safely step back one calendar day across month/year boundaries.
   */
  const getPreviousDateStr = (dateStr) => {
    const d = new Date(`${dateStr}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  const yesterday = getPreviousDateStr(today);

  // Determine starting point for current streak calculation:
  // If today is completed, count starting from today.
  // Otherwise, today is still in progress (pending), so count starting back from yesterday.
  let cursor = (dayByDate.has(today) && isDateSuccessful(today)) ? today : yesterday;

  let currentStreak = 0;
  while (isDateSuccessful(cursor)) {
    currentStreak++;
    cursor = getPreviousDateStr(cursor);
  }

  // Calculate longest historical streak across all recorded dates
  const sortedDates = [...dayByDate.keys()].sort();
  let longestStreak = 0;
  let activeRun = 0;
  let previousDate = null;

  for (const dateStr of sortedDates) {
    if (!isDateSuccessful(dateStr)) {
      activeRun = 0;
      previousDate = dateStr;
      continue;
    }

    // Check if this successful date directly continues the previous successful date
    const expectedPrev = getPreviousDateStr(dateStr);
    activeRun = (previousDate === expectedPrev) ? activeRun + 1 : 1;
    longestStreak = Math.max(longestStreak, activeRun);
    previousDate = dateStr;
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    todayComplete: isDateSuccessful(today),
  };
}

export default calculateStreaks;
