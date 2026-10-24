import mongoose from 'mongoose';

/**
 * User Schema
 * Represents an authenticated user of TaskPilot AI.
 * 
 * - Stores credentials (email and bcrypt password hash).
 * - Stores timezone for accurate local-date calculations (streaks, daily checklists).
 * - Stores user preferences (theme, daily cutoff hour).
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    preferences: {
      theme: {
        type: String,
        default: 'light',
      },
      cutoffHour: {
        type: Number,
        default: 23,
      },
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model('User', userSchema);
export default User;
