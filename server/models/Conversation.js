import mongoose from 'mongoose';

/**
 * Message Sub-Schema
 * Represents a single message within an assistant conversation.
 */
const messageSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system', 'tool'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    mode: {
      type: String,
      enum: ['text', 'voice'],
      default: 'text',
    },
    language: {
      type: String,
      default: 'en',
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'error'],
      default: 'sent',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

/**
 * Conversation Schema
 * Represents a persistent chat and voice interaction session for an authenticated user.
 */
const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: 'New Conversation',
      trim: true,
      maxlength: 120,
    },
    mode: {
      type: String,
      enum: ['text', 'voice', 'mixed'],
      default: 'mixed',
    },
    language: {
      type: String,
      enum: ['en', 'kn', 'hi', 'auto'],
      default: 'en',
    },
    messages: [messageSchema],
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to quickly fetch user's conversations sorted by last activity
conversationSchema.index({ userId: 1, lastActivityAt: -1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;
