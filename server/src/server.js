import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import jwt from 'jsonwebtoken';

// Import local services/controllers/middleware
import db from './services/db.js';
import { initGemini } from './services/geminiService.js';
import { requireAuth, requireRole } from './middleware/auth.js';
import * as authController from './controllers/authController.js';
import * as aiController from './controllers/aiController.js';

dotenv.config();

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_church_assistant_key_2026';

// Initialize Gemini API
initGemini();

const app = express();
const httpServer = createServer(app);

// Configure CORS to allow frontend
app.use(cors({
  origin: '*', // In production, restrict to your frontend domain
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Rate limiting for AI services (100 requests per 15 minutes)
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────

// Auth endpoints
app.post('/api/auth/signup', authController.signup);
app.post('/api/auth/login', authController.login);
app.get('/api/auth/me', requireAuth, authController.getCurrentUser);

// AI endpoints (protected)
app.post('/api/ai/detect', requireAuth, aiLimiter, aiController.detect);
app.post('/api/ai/notes', requireAuth, aiLimiter, aiController.getNotes);
app.post('/api/ai/reset', requireAuth, aiController.resetAiContext);

// Queue endpoints (sync state persistent on server)
app.get('/api/queue', (req, res) => {
  res.json(db.getQueue());
});

app.post('/api/queue', requireAuth, requireRole('operator'), (req, res) => {
  const { verseData } = req.body;
  if (!verseData) return res.status(400).json({ error: 'verseData is required' });
  const entry = db.addToQueue(verseData);
  res.status(201).json(entry);
});

app.put('/api/queue', requireAuth, requireRole('operator'), (req, res) => {
  const { queueList } = req.body;
  if (!Array.isArray(queueList)) return res.status(400).json({ error: 'queueList must be an array' });
  const updated = db.updateQueue(queueList);
  res.json(updated);
});

app.delete('/api/queue/:id', requireAuth, requireRole('operator'), (req, res) => {
  db.removeFromQueue(parseInt(req.params.id));
  res.json({ success: true });
});

app.delete('/api/queue', requireAuth, requireRole('operator'), (req, res) => {
  db.clearQueue();
  res.json({ success: true });
});

// History endpoints
app.get('/api/history', (req, res) => {
  res.json(db.getHistory());
});

app.post('/api/history', requireAuth, requireRole('operator'), (req, res) => {
  const { verseData, type } = req.body;
  if (!verseData) return res.status(400).json({ error: 'verseData is required' });
  const entry = db.addToHistory(verseData, type);
  res.status(201).json(entry);
});

app.delete('/api/history', requireAuth, requireRole('operator'), (req, res) => {
  db.clearHistory();
  res.json({ success: true });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ─────────────────────────────────────────────────
// Socket.io (Realtime Synchronization)
// ─────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Authenticate socket connections
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    socket.user = null;
    return next();
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    socket.user = null;
    next();
  }
});

// Track current active state to send to new connections
let currentDisplayState = {
  activeVerse: null,
  translation: 'KJV',
  background: 'dark',
  fontSize: 1.0,
  mode: 'fullscreen',
  align: 'center',
  theme: 'worship'
};

io.on('connection', (socket) => {
  const user = socket.user;
  // If authenticated, join a room specific to their church to isolate traffic.
  // Otherwise check if a churchName was passed in the query/auth (for displays/viewers)
  const roomQuery = socket.handshake.query?.churchName || socket.handshake.auth?.churchName;
  const churchRoom = user?.churchName 
    ? `church_${user.churchName.replace(/\s+/g, '_').toLowerCase()}` 
    : (roomQuery ? `church_${roomQuery.replace(/\s+/g, '_').toLowerCase()}` : 'church_default');
  
  socket.join(churchRoom);
  
  console.log(`[Socket] Connected: ${socket.id} (User: ${user ? user.email : 'Anonymous'}, Room: ${churchRoom})`);
  
  // Sync the current display state to the newly connected screen
  socket.emit('SYNC_STATE', currentDisplayState);
  
  // Send active queue & history too
  socket.emit('SYNC_QUEUE', db.getQueue());
  socket.emit('SYNC_HISTORY', db.getHistory());

  // Listen for control events
  const handleControlEvent = (event, payload) => {
    // Verify permission
    if (!user || (user.role !== 'admin' && user.role !== 'operator')) {
      console.warn(`[Socket] Unauthorized emit attempt of ${event} from ${socket.id}`);
      socket.emit('ERROR', { message: 'Unauthorized. Only operators can change display.' });
      return;
    }

    console.log(`[Socket] Broadcast ${event} in room ${churchRoom}:`, payload);
    
    // Track current state if it updates the screen
    if (event === 'DISPLAY_VERSE') {
      currentDisplayState.activeVerse = payload;
      // Automatically save to history on project
      if (payload) {
        db.addToHistory(payload, 'MANUAL');
        io.to(churchRoom).emit('SYNC_HISTORY', db.getHistory());
      }
    } else if (event === 'CLEAR_SCREEN') {
      currentDisplayState.activeVerse = null;
    } else if (event === 'CHANGE_TRANSLATION') {
      currentDisplayState.translation = payload.translation;
    } else if (event === 'CHANGE_BACKGROUND') {
      currentDisplayState.background = payload.background;
    } else if (event === 'CHANGE_FONT_SIZE') {
      currentDisplayState.fontSize = payload.size;
    } else if (event === 'CHANGE_MODE') {
      currentDisplayState.mode = payload.mode;
    } else if (event === 'CHANGE_ALIGN') {
      currentDisplayState.align = payload.align;
    } else if (event === 'CHANGE_THEME') {
      currentDisplayState.theme = payload.theme;
    }

    // Broadcast to everyone else in the church room
    socket.to(churchRoom).emit(event, payload);
  };

  // Bind events
  const events = [
    'DISPLAY_VERSE',
    'CLEAR_SCREEN',
    'CHANGE_TRANSLATION',
    'CHANGE_BACKGROUND',
    'CHANGE_FONT_SIZE',
    'CHANGE_MODE',
    'CHANGE_ALIGN',
    'CHANGE_THEME',
    'PING'
  ];

  events.forEach(event => {
    socket.on(event, (payload) => handleControlEvent(event, payload));
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[SanctiFlow Server] Running securely on port ${PORT}`);
});
