import { Routine, RoutineDay } from '../models/index.js';

/**
 * Routine Service
 * 
 * Handles timezone-aware date formatting and routine snapshotting.
 */

/**
 * Formats the current date into 'YYYY-MM-DD' according to the specified timezone.
 * Uses Canada ('en-CA') locale which adheres to the ISO 8601 YYYY-MM-DD standard.
 * 
 * @param {string} timezone - IANA timezone identifier (e.g., 'Asia/Kolkata', 'UTC')
 * @returns {string} Date string in 'YYYY-MM-DD'
 */
export function getLocalDate(timezone = 'UTC') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Retrieves or creates a daily routine snapshot for a user on a given date.
 * 
 * Snapshot Pattern:
 * When a user visits a date for the first time, this function finds all active routines
 * scheduled for that day of the week (0=Sunday ... 6=Saturday) and freezes them into
 * a RoutineDay document. This guarantees that future edits or deletions to routine
 * templates will never distort past checklist history.
 * 
 * @param {string|mongoose.Types.ObjectId} userId - ID of the authenticated user
 * @param {string} date - Date in 'YYYY-MM-DD' format
 * @param {string} timezone - User's configured timezone
 * @returns {Promise<Object>} The RoutineDay document
 */
export async function ensureRoutineDay(userId, date, timezone) {
  let dayRecord = await RoutineDay.findOne({ userId, localDate: date });
  if (dayRecord) {
    return dayRecord;
  }

  // Calculate day of the week (0=Sun .. 6=Sat) using midday UTC to prevent shift
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();

  // Find user's active routine templates scheduled for this weekday
  const activeRoutines = await Routine.find({
    userId,
    isActive: true,
    scheduledDays: weekday,
  }).sort({ sortOrder: 1 });

  // Use findOneAndUpdate with upsert and $setOnInsert to prevent race conditions
  dayRecord = await RoutineDay.findOneAndUpdate(
    { userId, localDate: date },
    {
      $setOnInsert: {
        userId,
        localDate: date,
        timezone,
        items: activeRoutines.map((routine) => ({
          routineId: routine._id,
          title: routine.title,
          isRequired: routine.isRequired,
          completed: false,
        })),
        eligible: activeRoutines.some((routine) => routine.isRequired),
        finalized: false,
      },
    },
    { upsert: true, new: true }
  );

  return dayRecord;
}

// Aliases matching earlier naming for backward compatibility
export const localDate = getLocalDate;
export const ensureDay = ensureRoutineDay;
