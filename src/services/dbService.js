import { get, set, update } from 'idb-keyval';
import { getAuthToken } from './authService';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://sanctiflow-backend.onrender.com/api' : 'http://localhost:3001/api');
const DB_KEYS = {
  BIBLE_CACHE: 'sanctiflow_bible_cache'
};

// Helper for authenticated requests
async function secureFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
  
  return response.json();
}

// ─────────────────────────────────────────────────
// HISTORY API
// ─────────────────────────────────────────────────
export async function getHistory() {
  try {
    return await secureFetch(`${API_BASE}/history`);
  } catch (err) {
    console.error('[dbService] getHistory failed:', err.message);
    return [];
  }
}

export async function addToHistory(verseData, type = 'AI') {
  try {
    return await secureFetch(`${API_BASE}/history`, {
      method: 'POST',
      body: JSON.stringify({ verseData, type })
    });
  } catch (err) {
    console.error('[dbService] addToHistory failed:', err.message);
    // Fallback mock representation for offline safety
    return { id: Date.now(), timestamp: new Date().toISOString(), type, ...verseData };
  }
}

export async function clearHistory() {
  try {
    await secureFetch(`${API_BASE}/history`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.error('[dbService] clearHistory failed:', err.message);
  }
}

// ─────────────────────────────────────────────────
// QUEUE API
// ─────────────────────────────────────────────────
export async function getQueue() {
  try {
    return await secureFetch(`${API_BASE}/queue`);
  } catch (err) {
    console.error('[dbService] getQueue failed:', err.message);
    return [];
  }
}

export async function addToQueue(verseData) {
  try {
    return await secureFetch(`${API_BASE}/queue`, {
      method: 'POST',
      body: JSON.stringify({ verseData })
    });
  } catch (err) {
    console.error('[dbService] addToQueue failed:', err.message);
    return { id: Date.now(), ...verseData };
  }
}

export async function updateQueue(newQueueList) {
  try {
    return await secureFetch(`${API_BASE}/queue`, {
      method: 'PUT',
      body: JSON.stringify({ queueList: newQueueList })
    });
  } catch (err) {
    console.error('[dbService] updateQueue failed:', err.message);
    return newQueueList;
  }
}

export async function removeFromQueue(id) {
  try {
    await secureFetch(`${API_BASE}/queue/${id}`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.error('[dbService] removeFromQueue failed:', err.message);
  }
}

export async function clearQueue() {
  try {
    await secureFetch(`${API_BASE}/queue`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.error('[dbService] clearQueue failed:', err.message);
  }
}

// ─────────────────────────────────────────────────
// BIBLE CACHE API (Persistent offline cache)
// ─────────────────────────────────────────────────
export async function getCachedChapter(cacheKey) {
  try {
    const cache = await get(DB_KEYS.BIBLE_CACHE) || {};
    return cache[cacheKey];
  } catch (err) {
    console.warn('[dbService] Bible cache read failed:', err.message);
    return null;
  }
}

export async function setCachedChapter(cacheKey, chapterData) {
  try {
    await update(DB_KEYS.BIBLE_CACHE, (old = {}) => {
      return { ...old, [cacheKey]: chapterData };
    });
  } catch (err) {
    console.warn('[dbService] Bible cache write failed:', err.message);
  }
}
