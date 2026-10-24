import mongoose from 'mongoose';

/**
 * Routine Schema (Template)
 * Represents a recurring habit template defined by the user.
 * 
 * - isRequired: When true, this routine must be completed on scheduled days
 *   to count toward the user's streak. Optional routines do not break streaks.
 * - scheduledDays: Array of numbers 0 (Sunday) through 6 (Saturday).
 * - isActive: Inactive routines are not snapshotted into future daily checklists.
 */
const routineSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    isRequired: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    scheduledDays: {
      type: [Number],
      default: [0, 1, 2, 3, 4, 5, 6], // Defaults to every day of the week
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const Routine = mongoose.model('Routine', routineSchema);
export default Routine;
