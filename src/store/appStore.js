import { create } from 'zustand';
import { APP_CONFIG } from '../utils/constants';

const useAppStore = create((set, get) => ({
  // ── AI Status ──────────────────────────────────────
  geminiReady: false,
  setGeminiReady: (ready) => set({ geminiReady: ready }),
  aiStatus: 'idle', // 'idle' | 'processing' | 'error'
  setAiStatus: (status) => set({ aiStatus: status }),

  // ── Voice / Transcription ──────────────────────────
  voiceStatus: 'stopped', // 'stopped'|'listening'|'paused'|'error'
  setVoiceStatus: (status) => set({ voiceStatus: status }),

  sessionStartTime: null,
  setSessionStartTime: (t) => set({ sessionStartTime: t }),

  transcriptEntries: [],
  interimText: '',
  addTranscript: (entry) => set(state => ({
    transcriptEntries: [...state.transcriptEntries, {
      id: Date.now(),
      text: entry.text,
      timestamp: new Date().toLocaleTimeString(),
      isFinal: true,
    }].slice(-200), // keep last 200 entries
  })),
  setInterimText: (text) => set({ interimText: text }),
  clearTranscript: () => set({ transcriptEntries: [], interimText: '' }),

  transcriptBuffer: '',
  appendToBuffer: (text) => set(state => ({
    transcriptBuffer: state.transcriptBuffer + ' ' + text,
  })),
  clearBuffer: () => set({ transcriptBuffer: '' }),

  // ── Scripture Detection ────────────────────────────
  detectedScriptures: [],
  addDetectedScripture: (scripture) => set(state => {
    const exists = state.detectedScriptures.some(
      s => s.book === scripture.book &&
           s.chapter === scripture.chapter &&
           s.verseStart === scripture.verseStart
    );
    if (exists) return state;
    return {
      detectedScriptures: [scripture, ...state.detectedScriptures].slice(0, 100),
    };
  }),
  clearDetectedScriptures: () => set({ detectedScriptures: [] }),

  // ── Approval Queue (medium-confidence 0.60–0.84) ──
  approvalQueue: [],
  addToApprovalQueue: (scripture) => set(state => ({
    approvalQueue: [scripture, ...state.approvalQueue].slice(0, 20),
  })),
  removeFromApprovalQueue: (id) => set(state => ({
    approvalQueue: state.approvalQueue.filter(s => s._id !== id),
  })),
  clearApprovalQueue: () => set({ approvalQueue: [] }),

  // ── Current Display ────────────────────────────────
  currentVerse: null,
  setCurrentVerse: (verse) => set({ currentVerse: verse }),
  clearCurrentVerse: () => set({ currentVerse: null }),

  // Display mode: 'fullscreen' | 'lower-third' | 'side-by-side' | 'stage'
  displayMode: 'fullscreen',
  setDisplayMode: (mode) => set({ displayMode: mode }),

  // ── Translation ────────────────────────────────────
  activeTranslation: APP_CONFIG.DEFAULT_TRANSLATION,
  setActiveTranslation: (t) => set({ activeTranslation: t }),

  secondaryTranslation: null,
  setSecondaryTranslation: (t) => set({ secondaryTranslation: t }),

  // ── Presentation ──────────────────────────────────
  activeBackground: 'dark',
  setActiveBackground: (bg) => set({ activeBackground: bg }),

  isLive: true,
  setIsLive: (live) => set({ isLive: live }),

  autoMode: true,
  setAutoMode: (auto) => set({ autoMode: auto }),

  fontSize: 1.0,
  setFontSize: (size) => set({ fontSize: Math.max(0.5, Math.min(2.5, size)) }),

  textAlign: 'center',
  setTextAlign: (align) => set({ textAlign: align }),

  showVerseNumbers: true,
  setShowVerseNumbers: (show) => set({ showVerseNumbers: show }),

  // ── History & Queue ────────────────────────────────
  scriptureHistory: [],
  setScriptureHistory: (history) => set({ scriptureHistory: history }),
  addToHistory: (entry) => set(state => ({
    scriptureHistory: [entry, ...state.scriptureHistory].slice(0, 200),
  })),

  verseQueue: [],
  setVerseQueue: (queue) => set({ verseQueue: queue }),

  // ── Sermon Intelligence ────────────────────────────
  sermonTopic: '',
  setSermonTopic: (topic) => set({ sermonTopic: topic }),

  sermonNotes: [],
  addSermonNote: (note) => set(state => ({
    sermonNotes: [...state.sermonNotes, { id: Date.now(), ...note }],
  })),
  clearSermonNotes: () => set({ sermonNotes: [] }),

  keyPhrases: [],
  setKeyPhrases: (phrases) => set({ keyPhrases: phrases }),

  suggestedScriptures: [],
  setSuggestedScriptures: (scriptures) => set({ suggestedScriptures: scriptures }),

  // ── Analytics ──────────────────────────────────────
  totalScripturesDetected: 0,
  incrementDetected: () => set(state => ({
    totalScripturesDetected: state.totalScripturesDetected + 1,
  })),
  totalScripturesProjected: 0,
  incrementProjected: () => set(state => ({
    totalScripturesProjected: state.totalScripturesProjected + 1,
  })),

  // ── Command Log ────────────────────────────────────
  commandLog: [],
  addCommandLog: (entry) => set(state => ({
    commandLog: [{
      id: Date.now(),
      ...entry,
      timestamp: new Date().toLocaleTimeString(),
    }, ...state.commandLog].slice(0, 200),
  })),
  clearCommandLog: () => set({ commandLog: [] }),

  // ── Toasts ────────────────────────────────────────
  toasts: [],
  addToast: (toast) => set(state => ({
    toasts: [...state.toasts, { id: Date.now(), ...toast }],
  })),
  removeToast: (id) => set(state => ({
    toasts: state.toasts.filter(t => t.id !== id),
  })),

  // API keys are managed server-side only (server/.env)
  // Clear any stale key from old versions
  ...((() => { try { localStorage.removeItem('sanctiflow_custom_api_key'); } catch {} return {}; })()),

  churchName: 'SanctiFlow Church',
  setChurchName: (name) => set({ churchName: name }),

  connectedScreens: 0,
  setConnectedScreens: (count) => set({ connectedScreens: count }),

  socketConnected: false,
  setSocketConnected: (connected) => set({ socketConnected: connected }),

  // ── Active Tab (Sidebar Navigation) ──────────────
  // 'main' | 'queue' | 'history' | 'sermon' | 'stats'
  activeTab: 'main',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── Speech Engine Settings ───────────────────────
  speechEngine: (() => {
    try {
      return localStorage.getItem('sanctiflow_speech_engine') || 'browser';
    } catch {
      return 'browser';
    }
  })(),
  setSpeechEngine: (engine) => {
    try {
      localStorage.setItem('sanctiflow_speech_engine', engine);
    } catch {}
    set({ speechEngine: engine });
  },
  deepgramApiKey: (() => {
    try {
      return localStorage.getItem('sanctiflow_deepgram_api_key') || '';
    } catch {
      return '';
    }
  })(),
  setDeepgramApiKey: (key) => {
    try {
      localStorage.setItem('sanctiflow_deepgram_api_key', key);
    } catch {}
    set({ deepgramApiKey: key });
  },
}));

export default useAppStore;
