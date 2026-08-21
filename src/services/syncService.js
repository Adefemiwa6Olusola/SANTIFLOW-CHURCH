// SanctiFlow Multi-Screen Sync Service v4
// Upgraded to Socket.io WebSockets for cross-device real-time sync
import { io } from 'socket.io-client';
import { getAuthToken, getCurrentUser } from './authService';
import useAppStore from '../store/appStore';

class SyncService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.initialized = false;
    this.connectedScreens = 0;
  }

  init() {
    // If already connected and healthy, don't re-initialize
    if (this.socket && this.socket.connected) {
      return;
    }

    // If there's a stale disconnected socket, clean it up
    if (this.socket) {
      this.socket.disconnect();
    }

    const wsUrl = import.meta.env.PROD ? 'https://santiflow-church.onrender.com' : 'http://localhost:3001';
    const token = getAuthToken();
    const currentUser = getCurrentUser();

    // Check query params for church identifier (crucial for anonymous projector/display screens)
    const urlParams = new URLSearchParams(window.location.search);
    const churchNameParam = urlParams.get('church') || urlParams.get('churchName');
    const tokenParam = urlParams.get('token');

    const activeToken = token || tokenParam;
    const activeChurch = churchNameParam || (currentUser ? currentUser.churchName : null);

    console.log('[SanctiFlow Sync] Connecting to:', wsUrl, 'Church:', activeChurch);

    this.socket = io(wsUrl, {
      auth: {
        token: activeToken,
        churchName: activeChurch
      },
      query: {
        churchName: activeChurch
      },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('[SanctiFlow Sync] WebSocket connected successfully. ID:', this.socket.id);
      useAppStore.getState().setSocketConnected(true);
      
      // Request active state on reconnect
      this.socket.emit('PING', { from: 'client' });
    });

    // Supported synchronization events
    const syncEvents = [
      'DISPLAY_VERSE',
      'CLEAR_SCREEN',
      'CHANGE_TRANSLATION',
      'CHANGE_BACKGROUND',
      'CHANGE_FONT_SIZE',
      'CHANGE_MODE',
      'CHANGE_ALIGN',
      'CHANGE_THEME',
      'SYNC_STATE',
      'SYNC_QUEUE',
      'SYNC_HISTORY',
      'PING'
    ];

    // Listen to events from the server and route them to local page listeners
    syncEvents.forEach(event => {
      this.socket.on(event, (payload) => {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(cb => {
          try { cb(payload); } catch (e) { console.error(`[SyncService] Error in listener for ${event}:`, e); }
        });
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[SanctiFlow Sync] WebSocket disconnected. Reason:', reason);
      useAppStore.getState().setSocketConnected(false);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[SanctiFlow Sync] Connection error:', err.message);
      useAppStore.getState().setSocketConnected(false);
    });

    this.initialized = true;
  }

  broadcast(type, payload = {}) {
    if (!this.socket) {
      this.init();
    }
    
    // First, trigger local listeners so this window reacts immediately (similar to BroadcastChannel behavior)
    const localCallbacks = this.listeners.get(type) || [];
    localCallbacks.forEach(cb => {
      try { cb(payload); } catch (e) {}
    });

    // Send to the backend server to broadcast to other screens
    if (this.socket && this.socket.connected) {
      this.socket.emit(type, payload);
    } else {
      console.warn('[SanctiFlow Sync] Socket not connected. Message queued or skipped:', type);
    }
  }

  on(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(callback);
    
    // Return unsubscribe function
    return () => {
      const cbs = this.listeners.get(type) || [];
      this.listeners.set(type, cbs.filter(cb => cb !== callback));
    };
  }

  // ── Helper functions for broadcasting events ──────────────────

  sendVerse(verseData) {
    this.broadcast('DISPLAY_VERSE', verseData);
  }

  sendClear() {
    this.broadcast('CLEAR_SCREEN', {});
  }

  sendTranslation(translation) {
    this.broadcast('CHANGE_TRANSLATION', { translation });
  }

  sendBackground(background) {
    this.broadcast('CHANGE_BACKGROUND', { background });
  }

  sendFontSize(size) {
    this.broadcast('CHANGE_FONT_SIZE', { size });
  }

  sendDisplayMode(mode) {
    this.broadcast('CHANGE_MODE', { mode });
  }

  sendTextAlign(align) {
    this.broadcast('CHANGE_ALIGN', { align });
  }

  sendTheme(theme) {
    this.broadcast('CHANGE_THEME', { theme });
  }

  sendPing() {
    this.broadcast('PING', { from: 'operator' });
  }

  // ── Teardown ──────────────────────────────────────────────────

  destroy() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
    this.initialized = false;
  }
}

export const syncService = new SyncService();
export default syncService;
