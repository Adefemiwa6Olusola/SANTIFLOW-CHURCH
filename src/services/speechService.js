// SanctiFlow Speech Recognition & Audio Pipeline Service
// Integrating Web Speech API + Web Audio API for visual monitoring and device selection

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
      
    // Audio context nodes for visual monitoring
    this.audioContext = null;
    this.stream = null;
    this.analyser = null;
    this.source = null;
    this.monitorActive = false;
    this.selectedDeviceId = null;
    this.devices = [];
  }

  async getAudioDevices() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      console.warn('[SpeechService] mediaDevices API not supported');
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.devices = devices.filter(device => device.kind === 'audioinput');
      console.log('[SpeechService] Detected audio input devices:', this.devices);
      this.emit('devices-updated', this.devices);
      return this.devices;
    } catch (err) {
      console.error('[SpeechService] Error listing audio devices:', err);
      return [];
    }
  }

  async startAudioMonitoring(deviceId = null) {
    if (typeof window === 'undefined') return;
    this.stopAudioMonitoring();

    const targetDeviceId = deviceId || this.selectedDeviceId;
    this.selectedDeviceId = targetDeviceId;

    try {
      const constraints = {
        audio: targetDeviceId ? { deviceId: { exact: targetDeviceId } } : true
      };

      console.log('[SpeechService] Starting microphone stream monitoring with constraints:', constraints);
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[SpeechService] Microphone stream successfully acquired for monitoring');

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
        const normalizedVolume = Math.min(average / 128, 1); // 0.0 to 1.0

        this.emit('audio-level', { level: normalizedVolume });
        
        if (this.monitorActive) {
          requestAnimationFrame(checkVolume);
        }
      };

      checkVolume();
      this.emit('mic-status', { status: 'connected', message: 'Microphone level monitoring active' });
      
      // Update device list as well in case label permissions were granted now
      await this.getAudioDevices();
    } catch (err) {
      console.error('[SpeechService] Audio monitoring initialization failed:', err);
      this.emit('mic-status', { status: 'error', message: `Microphone access denied: ${err.message}` });
      this.emit('error', { message: `Microphone permissions error: ${err.message}` });
    }
  }

  stopAudioMonitoring() {
    console.log('[SpeechService] Stopping audio stream monitoring');
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

    console.log('[SpeechService] Initializing Web Speech API recognition engine');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      console.log('[SpeechService] Web Speech recognition engine started listening');
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
        console.log('[SpeechService] Final transcript segment generated:', cleanText);
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
      console.warn(`[SpeechService] Web Speech recognition error: "${event.error}"`);
      
      let errorMsg = `Speech recognition error: ${event.error}`;
      if (event.error === 'not-allowed') {
        errorMsg = 'Microphone access blocked. Please enable microphone permissions in your browser settings.';
        this.emit('mic-status', { status: 'blocked', message: errorMsg });
      } else if (event.error === 'no-speech') {
        errorMsg = 'No speech detected. Check if your microphone is active or not muted.';
      } else if (event.error === 'network') {
        errorMsg = 'Speech recognition network error. Reconnecting...';
      }

      this.emit('error', { message: errorMsg, code: event.error });

      if (event.error === 'not-allowed') {
        this.isListening = false;
        this.emit('status', { status: 'error' });
        this.stopAudioMonitoring();
      } else if (event.error === 'network') {
        this.reconnect();
      }
    };

    this.recognition.onend = () => {
      console.log('[SpeechService] Web Speech recognition stream ended');
      if (this.isListening && !this.isPaused) {
        console.log('[SpeechService] Auto-restarting speech stream...');
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
          console.log('[SpeechService] Executing auto-restart on speech engine');
          this.recognition.start();
        } catch (e) {
          // Already running or starting up, wait
        }
      }
    }, 300);
  }

  async start(deviceId = null) {
    console.log('[SpeechService] Start command received');
    
    // Explicitly start audio context monitoring for live feedback
    await this.startAudioMonitoring(deviceId);

    if (!this.recognition) {
      if (!this.init()) return;
    }
    
    try {
      this.recognition.start();
      this.isListening = true;
      this.isPaused = false;
      this.emit('status', { status: 'listening' });
      console.log('[SpeechService] Listening successfully activated');
    } catch (e) {
      if (e.message?.includes('already started')) {
        this.isListening = true;
      } else {
        console.warn('[SpeechService] Error during start, attempting reconnect:', e.message);
        this.reconnect();
      }
    }
  }

  stop() {
    console.log('[SpeechService] Stop command received');
    this.isListening = false;
    this.isPaused = false;
    clearTimeout(this.restartTimeout);
    
    this.stopAudioMonitoring();

    if (this.recognition) {
      try {
        this.recognition.abort(); // Use abort for immediate cancellation
      } catch (e) { /* ignore */ }
    }
    this.emit('status', { status: 'stopped' });
  }

  pause() {
    console.log('[SpeechService] Pause command received');
    this.isPaused = true;
    clearTimeout(this.restartTimeout);
    
    // Don't stop audio monitor completely so they can still see mic activity,
    // but suspend the speech recognizer
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) { /* ignore */ }
    }
    this.emit('status', { status: 'paused' });
  }

  resume() {
    console.log('[SpeechService] Resume command received');
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
        try { cb(data); } catch (e) { console.error(`[SpeechService] Error in event listener for ${event}:`, e); }
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
