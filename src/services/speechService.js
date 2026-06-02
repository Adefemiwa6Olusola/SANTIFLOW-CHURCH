// SanctiFlow Speech Recognition & Audio Pipeline Service
// Resilient Production-grade Speech-to-Text with Silent Auto-Recovery and Web Audio diagnostics

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
      'audio-level': [],
      'mic-status': [],
      'devices-updated': []
    };
    
    this.restartTimeout = null;
    this.finalTranscript = '';
    this.supported = typeof window !== 'undefined' && 
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
      
    // Audio Context nodes for visual level indicator
    this.audioContext = null;
    this.stream = null;
    this.analyser = null;
    this.source = null;
    this.monitorActive = false;
    this.selectedDeviceId = null;
    this.devices = [];

    // Reconnection & Error Backoff State
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 5000;
    this.baseReconnectDelay = 300;
  }

  async getAudioDevices() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      console.warn('[SpeechService] mediaDevices API not supported');
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.devices = devices.filter(device => device.kind === 'audioinput');
      this.emit('devices-updated', this.devices);
      return this.devices;
    } catch (err) {
      console.error('[SpeechService] Error listing audio devices:', err);
      return [];
    }
  }

  async startAudioMonitoring(deviceId = null) {
    if (typeof window === 'undefined') return;
    
    // If stream is already active and device matches, do not recreate
    if (this.stream && this.selectedDeviceId === deviceId) {
      return;
    }

    this.stopAudioMonitoring();
    this.selectedDeviceId = deviceId;

    try {
      const constraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true
      };

      console.log('[SpeechService] Starting microphone stream monitoring:', constraints);
      try {
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        if (deviceId) {
          console.warn('[SpeechService] getUserMedia with exact deviceId failed, falling back to default microphone:', firstErr.message);
          this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          this.selectedDeviceId = null;
        } else {
          throw firstErr;
        }
      }

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      this.monitorActive = true;
      const checkVolume = () => {
        if (!this.monitorActive || !this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);
        
        let total = 0;
        for (let i = 0; i < bufferLength; i++) {
          total += dataArray[i];
        }
        const average = total / bufferLength;
        const normalizedVolume = Math.min(average / 128, 1);

        this.emit('audio-level', { level: normalizedVolume });
        
        if (this.monitorActive) {
          requestAnimationFrame(checkVolume);
        }
      };

      checkVolume();
      this.emit('mic-status', { status: 'connected', message: 'Microphone level monitoring active' });
      await this.getAudioDevices();
    } catch (err) {
      console.error('[SpeechService] Audio monitoring initialization failed:', err);
      this.emit('mic-status', { status: 'error', message: `Microphone access denied: ${err.message}` });
      // Only emit permission errors to the user (transient network issues are handled silently)
      this.emit('error', { message: `Microphone permissions blocked: ${err.message}` });
    }
  }

  stopAudioMonitoring() {
    this.monitorActive = false;
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.analyser = null;
    this.source = null;
    this.emit('mic-status', { status: 'disconnected', message: 'Microphone level monitoring inactive' });
  }

  init() {
    if (!this.supported) {
      this.emit('error', { message: 'Speech recognition is not supported in this browser. Please use Chrome or Edge.' });
      return false;
    }

    console.log('[SpeechService] Instantiating SpeechRecognition client');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      console.log('[SpeechService] Speech Recognition server connected and listening.');
      this.reconnectAttempts = 0; // reset attempts on successful start
      this.emit('status', { status: 'listening' });
    };

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
        const cleanText = newFinal.trim();
        console.log('[SpeechService] Speech finalized:', cleanText);
        this.emit('transcript', {
          text: cleanText,
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
      console.warn(`[SpeechService] Speech Engine Error Event: "${event.error}"`);
      
      if (event.error === 'not-allowed') {
        const errorMsg = 'Microphone access blocked. Please enable microphone permissions in your browser settings.';
        this.emit('mic-status', { status: 'blocked', message: errorMsg });
        this.emit('error', { message: errorMsg, code: event.error });
        this.stop();
      } else if (event.error === 'no-speech') {
        // Silent recovery for no-speech timeout (Google's automatic stop)
        console.log('[SpeechService] Silent interval: restarting speech recognition loop.');
        this.emit('status', { status: 'connecting' });
      } else if (event.error === 'network') {
        // Suppress displaying network error in operator panel to prevent panic.
        // Instead, mark status as 'reconnecting' and perform automatic recovery.
        console.warn('[SpeechService] Cloud Speech API network disconnect. Re-initializing engine...');
        this.emit('status', { status: 'reconnecting' });
        
        // Recreate recognition instance completely on next start to reset Chrome's network socket
        this.recognition = null;
      } else {
        // For other random disconnections, trigger reconnect
        this.emit('status', { status: 'reconnecting' });
      }
    };

    this.recognition.onend = () => {
      console.log('[SpeechService] Speech Recognition loop ended');
      
      if (this.isListening && !this.isPaused) {
        console.log('[SpeechService] Re-entering transcription loop...');
        this.reconnect();
      } else {
        this.emit('status', { status: 'stopped' });
      }
    };

    return true;
  }

  reconnect() {
    clearTimeout(this.restartTimeout);
    
    // Calculate exponential backoff delay to avoid slamming Chrome's sockets
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    
    this.reconnectAttempts++;
    console.log(`[SpeechService] Reconnecting in ${Math.round(delay)}ms (Attempt #${this.reconnectAttempts})`);

    this.restartTimeout = setTimeout(() => {
      if (this.isListening && !this.isPaused) {
        if (!this.recognition) {
          this.init();
        }
        try {
          this.recognition.start();
        } catch (e) {
          // Already active or transition state, wait for next onend trigger
          console.warn('[SpeechService] Start failed during reconnect (already running):', e.message);
        }
      }
    }, delay);
  }

  async start(deviceId = null) {
    console.log('[SpeechService] Activating speech recognition pipeline');
    this.isListening = true;
    this.isPaused = false;
    
    // Keep hardware microphone monitoring active
    await this.startAudioMonitoring(deviceId);

    if (!this.recognition) {
      this.init();
    }
    
    try {
      this.recognition.start();
      console.log('[SpeechService] Recognition engine listening');
    } catch (e) {
      if (e.message?.includes('already started')) {
        // Already running, update state
        this.emit('status', { status: 'listening' });
      } else {
        console.warn('[SpeechService] Engine start threw exception, queueing reconnect:', e.message);
        this.reconnect();
      }
    }
  }

  stop() {
    console.log('[SpeechService] Disabling speech recognition pipeline');
    this.isListening = false;
    this.isPaused = false;
    clearTimeout(this.restartTimeout);
    
    this.stopAudioMonitoring();

    if (this.recognition) {
      try {
        this.recognition.abort(); // Use abort to cancel immediately
      } catch (e) { /* ignore */ }
    }
    this.emit('status', { status: 'stopped' });
  }

  pause() {
    console.log('[SpeechService] Pausing speech recognition client');
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
    console.log('[SpeechService] Resuming speech recognition client');
    this.isPaused = false;
    this.start(this.selectedDeviceId);
  }

  resetTranscript() {
    this.finalTranscript = '';
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try { cb(data); } catch (e) { console.error(`[SpeechService] Error in listener for ${event}:`, e); }
      });
    }
  }

  destroy() {
    this.stop();
    this.listeners = {};
    this.recognition = null;
  }
}

export const speechService = new SpeechService();
export default speechService;
