import dns from 'node:dns';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

// Internal route modules
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import routineRoutes from './routes/routineRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import agentRoutes from './routes/agentRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';

// Centralized error handling
import { errorHandler } from './middleware/errorHandler.js';

// Load environment variables from server/.env
dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

// Prefer IPv4 for consistent local and MongoDB Atlas DNS resolution
dns.setDefaultResultOrder('ipv4first');

const app = express();

// Security and request parsing middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '30kb' }));
app.use(cookieParser());

// Health check endpoint for uptime monitors
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Mount feature routers
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/routines', routineRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/conversations', conversationRoutes);

// Centralized error handling middleware (must be registered after all routes)
app.use(errorHandler);

// Database connection & Server initialization
const port = process.env.PORT || 4000;

if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
      const server = app.listen(port, () => console.log(`TaskPilot API listening on port ${port}`));

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`Port ${port} is currently in use. Stop the existing process or set a different PORT in server/.env.`);
        } else {
          console.error('Server error:', err.message);
        }
        process.exit(1);
      });

      const handleExit = async () => {
        server.close();
        await mongoose.connection.close();
        process.exit(0);
      };

      process.on('SIGTERM', handleExit);
      process.on('SIGINT', handleExit);
    })
    .catch((error) => {
      console.error('MongoDB connection failed:', error.message);
      process.exit(1);
    });
} else if (process.env.NODE_ENV !== 'test') {
  console.error('Set MONGODB_URI in server/.env before starting.');
  process.exit(1);
}

export default app;
