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
import reminderRoutes from './routes/reminderRoutes.js';
import n8nRoutes from './routes/n8nRoutes.js';

// Centralized error handling
import { errorHandler } from './middleware/errorHandler.js';

// Load environment variables from server/.env
dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

// Prefer IPv4 for consistent local and MongoDB Atlas DNS resolution
dns.setDefaultResultOrder('ipv4first');

const app = express();

// Trust reverse proxy (e.g. Render, Vercel, Cloudflare) for accurate client IP identification
app.set('trust proxy', 1);

// Security and request parsing middleware
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, curl, n8n)
      if (!origin) return callback(null, true);
      
      const allowed = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'];
      if (process.env.CLIENT_ORIGIN) {
        process.env.CLIENT_ORIGIN.split(',').forEach((o) => {
          allowed.push(o.trim().replace(/\/$/, ''));
        });
      }

      const cleanOrigin = origin.replace(/\/$/, '');
      if (
        allowed.includes(cleanOrigin) ||
        /\.vercel\.app$/.test(new URL(cleanOrigin).hostname)
      ) {
        return callback(null, true);
      }
      
      // Fallback: accept configured origin or allow in dev
      return callback(null, true);
    },
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
app.use('/api/reminders', reminderRoutes);
app.use('/api/n8n', n8nRoutes);
app.use('/api/automation', n8nRoutes);

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
