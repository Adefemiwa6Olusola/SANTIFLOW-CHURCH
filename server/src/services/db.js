import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Initialize database file if it doesn't exist
function initDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      users: [],
      history: [],
      queue: [],
      resetTokens: [],
      otps: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

// Read database
function readDb() {
  initDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    // Ensure arrays exist (migration for existing DBs)
    if (!parsed.resetTokens) parsed.resetTokens = [];
    if (!parsed.otps) parsed.otps = [];
    return parsed;
  } catch (err) {
    console.error('Error reading database file, resetting:', err);
    return { users: [], history: [], queue: [], resetTokens: [] };
  }
}

// Write database atomically
function writeDb(data) {
  initDb();
  const tempFile = DB_FILE + '.tmp';
  try {
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
    return true;
  } catch (err) {
    console.error('Failed to write database:', err);
    try {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    } catch {}
    return false;
  }
}

export const db = {
  // Users API
  getUsers() {
    return readDb().users || [];
  },
  
  findUserByEmail(email) {
    const normalized = email.toLowerCase().trim();
    return this.getUsers().find(u => u.email === normalized);
  },
  
  findUserById(id) {
    return this.getUsers().find(u => u.id === id);
  },
  
  createUser(user) {
    const data = readDb();
    const newUser = {
      id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      email: user.email.toLowerCase().trim(),
      password: user.password, // hashed
      name: user.name,
      churchName: user.churchName || '',
      role: user.role || 'operator',
      createdAt: new Date().toISOString()
    };
    data.users.push(newUser);
    writeDb(data);
    return newUser;
  },

  updateUserPassword(userId, hashedPassword) {
    const data = readDb();
    const idx = data.users.findIndex(u => u.id === userId);
    if (idx === -1) return false;
    data.users[idx].password = hashedPassword;
    data.users[idx].updatedAt = new Date().toISOString();
    writeDb(data);
    return true;
  },

  // ── Password Reset Tokens ────────────────────────
  createResetToken(tokenData) {
    const data = readDb();
    // Remove any existing tokens for this user (one active token per user)
    data.resetTokens = data.resetTokens.filter(t => t.userId !== tokenData.userId);
    data.resetTokens.push({
      ...tokenData,
      createdAt: new Date().toISOString()
    });
    writeDb(data);
    return tokenData;
  },

  findResetToken(token) {
    const data = readDb();
    return data.resetTokens.find(t => t.token === token) || null;
  },

  deleteResetToken(token) {
    const data = readDb();
    data.resetTokens = data.resetTokens.filter(t => t.token !== token);
    writeDb(data);
  },

  cleanExpiredTokens() {
    const data = readDb();
    const now = Date.now();
    const before = data.resetTokens.length;
    data.resetTokens = data.resetTokens.filter(t => t.expiresAt > now);
    if (data.resetTokens.length < before) {
      writeDb(data);
      console.log(`[DB] Cleaned ${before - data.resetTokens.length} expired reset token(s)`);
    }
  },

  // ── OTP verification ─────────────────────────────
  createOtp(otpData) {
    const data = readDb();
    if (!data.otps) data.otps = [];
    // Remove any existing OTP records for this email
    data.otps = data.otps.filter(o => o.email !== otpData.email);
    const newOtp = {
      ...otpData,
      createdAt: new Date().toISOString()
    };
    data.otps.push(newOtp);
    writeDb(data);
    return newOtp;
  },

  findOtpByEmail(email) {
    const data = readDb();
    if (!data.otps) return null;
    const normalized = email.toLowerCase().trim();
    return data.otps.find(o => o.email === normalized) || null;
  },

  deleteOtp(email) {
    const data = readDb();
    if (!data.otps) return;
    const normalized = email.toLowerCase().trim();
    data.otps = data.otps.filter(o => o.email !== normalized);
    writeDb(data);
  },

  updateOtpAttempts(email, attempts) {
    const data = readDb();
    if (!data.otps) return;
    const normalized = email.toLowerCase().trim();
    const idx = data.otps.findIndex(o => o.email === normalized);
    if (idx !== -1) {
      data.otps[idx].attempts = attempts;
      writeDb(data);
      return true;
    }
    return false;
  },

  // History API
  getHistory() {
    return readDb().history || [];
  },
  
  addToHistory(verseData, type = 'AI') {
    const data = readDb();
    const entry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      type, // 'AI' | 'MANUAL' | 'QUEUE'
      ...verseData
    };
    
    let history = data.history || [];
    history = [entry, ...history].slice(0, 100); // Keep last 100
    data.history = history;
    writeDb(data);
    return entry;
  },
  
  clearHistory() {
    const data = readDb();
    data.history = [];
    writeDb(data);
  },

  // Queue API
  getQueue() {
    return readDb().queue || [];
  },
  
  addToQueue(verseData) {
    const data = readDb();
    const entry = {
      id: Date.now(),
      ...verseData
    };
    data.queue = [...(data.queue || []), entry];
    writeDb(data);
    return entry;
  },
  
  updateQueue(newQueue) {
    const data = readDb();
    data.queue = newQueue;
    writeDb(data);
    return newQueue;
  },
  
  removeFromQueue(id) {
    const data = readDb();
    data.queue = (data.queue || []).filter(i => i.id !== id);
    writeDb(data);
  },
  
  clearQueue() {
    const data = readDb();
    data.queue = [];
    writeDb(data);
  }
};

export default db;

