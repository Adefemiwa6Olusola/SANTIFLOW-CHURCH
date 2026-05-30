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
      queue: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

// Read database
function readDb() {
  initDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database file, resetting:', err);
    return { users: [], history: [], queue: [] };
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
