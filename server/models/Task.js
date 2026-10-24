import mongoose from 'mongoose';

/**
 * Task Schema
 * Represents a standard task or to-do item in TaskPilot.
 * 
 * Important note on architecture:
 * Tasks are separate from routines. Normal task completion does NOT contribute
 * to routine streaks, keeping habit tracking distinct from ad-hoc task management.
 * 
 * Compound Index:
 * { userId: 1, dueDate: 1, status: 1 } optimizes queries that filter tasks
 * by user, due date (e.g. today / calendar view), and completion status.
 */
const taskSchema = new mongoose.Schema(
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
      maxlength: 160,
    },
    description: {
      type: String,
      default: '',
    },
    priority: {
      type: String,
      enum: ['urgent', 'high', 'medium', 'low'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'completed'],
      default: 'todo',
    },
    dueDate: {
      type: Date,
      default: null,
    },
    estimatedMinutes: {
      type: Number,
      min: 1,
      max: 1440,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    source: {
      type: String,
      enum: ['manual', 'ai', 'voice'],
      default: 'manual',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient user-scoped calendar, deadline, and status queries
taskSchema.index({ userId: 1, dueDate: 1, status: 1 });

export const Task = mongoose.model('Task', taskSchema);
export default Task;
