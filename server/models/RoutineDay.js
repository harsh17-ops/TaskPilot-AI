import mongoose from 'mongoose';

/**
 * RoutineDay Schema (Date Snapshot)
 * Represents a date-specific snapshot of routine checklist items for a user.
 * 
 * Why snapshots matter (Key Architectural Concept):
 * When a user modifies or deletes a routine template today, past days must NOT
 * change retroactively. The first time a user visits or checks off a date,
 * active scheduled routines are snapshotted into this RoutineDay document.
 * 
 * - localDate: ISO date string 'YYYY-MM-DD' formatted for the user's timezone.
 * - eligible: True if this date has at least one required routine item.
 * - items: Array of checklist items snapshotted for that specific date.
 * 
 * Unique compound index on { userId: 1, localDate: 1 } ensures each user has
 * at most one snapshot per calendar date.
 */
const routineDaySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    localDate: {
      type: String,
      required: true,
    },
    timezone: {
      type: String,
      required: true,
    },
    items: [
      {
        routineId: {
          type: mongoose.Schema.Types.ObjectId,
        },
        title: {
          type: String,
        },
        isRequired: {
          type: Boolean,
        },
        completed: {
          type: Boolean,
          default: false,
        },
        completedAt: {
          type: Date,
        },
      },
    ],
    eligible: {
      type: Boolean,
      default: false,
    },
    finalized: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce unique snapshot per user and local calendar date
routineDaySchema.index({ userId: 1, localDate: 1 }, { unique: true });

export const RoutineDay = mongoose.model('RoutineDay', routineDaySchema);
export default RoutineDay;
