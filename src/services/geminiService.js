import { getAuthToken } from './authService';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Rolling context window (kept client-side just to mirror API signatures if needed, though backend manages it)
const contextWindow = [];
const MAX_CONTEXT_CHUNKS = 5;

export function initGemini() {
  // Frontend no longer needs API keys. It just checks if backend is configured
  console.log('[SanctiFlow AI] Client configured to use secure backend API');
  return true;
}

export function isGeminiReady() {
  // Assumes ready if backend is reachable
  return true;
}

export function addToContext(text) {
  contextWindow.push(text.trim());
  if (contextWindow.length > MAX_CONTEXT_CHUNKS) contextWindow.shift();
}

export function getContext() {
  return contextWindow.join(' ');
}

export async function resetContext() {
  contextWindow.length = 0;
  
  const token = getAuthToken();
  if (!token) return;
  
  try {
    await fetch(`${API_BASE}/ai/reset`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (err) {
    console.warn('[SanctiFlow AI] Failed to reset context on backend:', err.message);
  }
}

export async function detectScriptures(transcriptChunk) {
  const token = getAuthToken();
  if (!token) {
    console.warn('[SanctiFlow AI] Cannot detect scriptures: User is not authenticated');
    return { references: [], commands: [], sermonTopics: [], keyPhrases: [] };
  }

  const chunk = transcriptChunk?.trim();
  if (!chunk || chunk.length < 5) {
    return { references: [], commands: [], sermonTopics: [], keyPhrases: [] };
  }

  // Keep client context updated
  addToContext(chunk);

  try {
    const response = await fetch(`${API_BASE}/ai/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ transcriptChunk: chunk })
    });

    if (!response.ok) {
      let data = {};
      try { data = await response.json(); } catch {}

      if (response.status === 401) {
        const msg = data.error || '';
        // Auth middleware returns "Authorization token required" or "Request is not authorized"
        // AI controller returns "Gemini API key is invalid or unauthorized"
        if (msg.includes('Gemini')) {
          return { references: [], commands: [], sermonTopics: [], keyPhrases: [], error: 'INVALID_KEY' };
        }
        // Login session expired — not an API key problem
        return { references: [], commands: [], sermonTopics: [], keyPhrases: [], error: 'SESSION_EXPIRED' };
      }
      if (response.status === 429) {
        return { references: [], commands: [], sermonTopics: [], keyPhrases: [], error: 'QUOTA_EXCEEDED' };
      }
      // 500 or other server error — don't alarm the user
      console.warn('[SanctiFlow AI] Server error:', response.status, data.error);
      return { references: [], commands: [], sermonTopics: [], keyPhrases: [] };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    // Network error (server down, no internet, etc.) — fail silently
    console.warn('[SanctiFlow AI] Network error:', err.message);
    return { references: [], commands: [], sermonTopics: [], keyPhrases: [] };
  }
}

export async function generateSermonNotes(fullTranscript) {
  const token = getAuthToken();
  if (!token || !fullTranscript?.trim()) return null;

  try {
    const response = await fetch(`${API_BASE}/ai/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ fullTranscript })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'AI notes generation failed');
    }

    return data;
  } catch (err) {
    console.error('[SanctiFlow AI] Secure notes generation error:', err.message);
    return null;
  }
}
