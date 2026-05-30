// SanctiFlow Speech Recognition Service
// Wraps the Web Speech API for robust continuous real-time transcription

class SpeechService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.isPaused = false;
    this.listeners = {
      transcript: [],
      interim: [],
      error: [],
      status: [],
    };
    this.restartTimeout = null;
    this.finalTranscript = '';
    this.supported = typeof window !== 'undefined' && 
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  }

  init() {
    if (!this.supported) {
      this.emit('error', { message: 'Speech recognition not supported. Please use Chrome or Edge.' });
      return false;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let newFinal = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newFinal += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (newFinal) {
        this.finalTranscript += newFinal;
        this.emit('transcript', {
          text: newFinal.trim(),
          fullText: this.finalTranscript.trim(),
          isFinal: true,
          confidence: event.results[event.results.length - 1]?.[0]?.confidence || 0,
        });
      }

      if (interimTranscript) {
        this.emit('interim', {
          text: interimTranscript,
          isFinal: false,
        });
      }
    };

    this.recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        this.emit('error', { message: 'Microphone access denied. Please allow microphone access.' });
        this.isListening = false;
        this.emit('status', { status: 'error' });
      } else if (event.error === 'network') {
        // Network errors happen often. Auto-reconnect quickly.
        this.reconnect();
      } else if (event.error === 'no-speech') {
        // Silence. Ignore, but ensure we keep listening.
      } else if (event.error === 'aborted') {
        // Intentional stop
      } else {
        console.warn(`Speech error: ${event.error}`);
        this.reconnect();
      }
    };

    this.recognition.onend = () => {
      // Auto-restart aggressively if we are supposed to be listening
      if (this.isListening && !this.isPaused) {
        this.reconnect();
      } else {
        this.emit('status', { status: 'stopped' });
      }
    };

    return true;
  }

  reconnect() {
    clearTimeout(this.restartTimeout);
    this.restartTimeout = setTimeout(() => {
      if (this.isListening && !this.isPaused && this.recognition) {
        try {
          this.recognition.start();
        } catch (e) {
          // Ignore if already started
        }
      }
    }, 250); // Fast reconnect
  }

  start() {
    if (!this.recognition) {
      if (!this.init()) return;
    }
    try {
      this.recognition.start();
      this.isListening = true;
      this.isPaused = false;
      this.emit('status', { status: 'listening' });
    } catch (e) {
      if (e.message?.includes('already started')) {
        this.isListening = true;
      } else {
        this.reconnect();
      }
    }
  }

  stop() {
    this.isListening = false;
    this.isPaused = false;
    clearTimeout(this.restartTimeout);
    if (this.recognition) {
      try {
        this.recognition.abort(); // Use abort for immediate stop without firing onend reconnect
      } catch (e) { /* ignore */ }
    }
    this.emit('status', { status: 'stopped' });
  }

  pause() {
    this.isPaused = true;
    clearTimeout(this.restartTimeout);
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) { /* ignore */ }
    }
    this.emit('status', { status: 'paused' });
  }

  resume() {
    this.isPaused = false;
    this.start();
  }

  resetTranscript() {
    this.finalTranscript = '';
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  destroy() {
    this.stop();
    this.listeners = { transcript: [], interim: [], error: [], status: [] };
    this.recognition = null;
  }
}

// Singleton
export const speechService = new SpeechService();
export default speechService;
