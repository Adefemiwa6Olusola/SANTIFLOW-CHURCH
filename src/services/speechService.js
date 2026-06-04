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

  teardownSpeechRecognition() {
    clearTimeout(this.restartTimeout);
    if (this.recognition) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[SpeechService @ ${timestamp}] Tearing down SpeechRecognition instance`);
      this.recognition.onstart = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      try {
        this.recognition.abort();
      } catch (e) {
        console.warn(`[SpeechService @ ${timestamp}] Aborting old recognition failed:`, e.message);
      }
      this.recognition = null;
    }
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
      let isUserSpeaking = false;

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

        // Speaking transition detection
        const speakingNow = normalizedVolume > 0.05;
        if (speakingNow !== isUserSpeaking) {
          isUserSpeaking = speakingNow;
          const timestamp = new Date().toLocaleTimeString();
          if (isUserSpeaking) {
            console.log(`[SpeechService @ ${timestamp}] 🗣 SPEECH DETECTED`);
          } else {
            console.log(`[SpeechService @ ${timestamp}] 💤 SPEECH NOT DETECTED (SILENT)`);
          }
        }
        
        if (this.monitorActive) {
          requestAnimationFrame(checkVolume);
        }
      };

      checkVolume();
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[SpeechService @ ${timestamp}] 🎤 MICROPHONE CONNECTED (Device ID: ${this.selectedDeviceId || 'default'})`);
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
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[SpeechService @ ${timestamp}] 🎤 MICROPHONE DISCONNECTED`);
    this.emit('mic-status', { status: 'disconnected', message: 'Microphone level monitoring inactive' });
  }

  init() {
    if (!this.supported) {
      this.emit('error', { message: 'Speech recognition is not supported in this browser. Please use Chrome or Edge.' });
      return false;
    }

    // Cleanly tear down any existing speech recognition instance first
    this.teardownSpeechRecognition();

    const timestamp = new Date().toLocaleTimeString();
    console.log(`[SpeechService @ ${timestamp}] Instantiating SpeechRecognition client`);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[SpeechService @ ${timestamp}] 🟢 LISTENING STARTED`);
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
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[SpeechService @ ${timestamp}] 📝 TRANSCRIPT RECEIVED: "${cleanText}"`);
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
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[SpeechService @ ${timestamp}] ❌ TRANSCRIPT FAILED: ${event.error}`);
      console.warn(`[SpeechService] Speech Engine Error Event: "${event.error}"`);
      
      if (event.error === 'not-allowed') {
        const errorMsg = 'Microphone access blocked. Please enable microphone permissions in your browser settings.';
        this.emit('mic-status', { status: 'blocked', message: errorMsg });
        this.emit('error', { message: errorMsg, code: event.error });
        this.stop();
      } else if (event.error === 'service-not-allowed') {
        const errorMsg = 'Speech Recognition service refused (service-not-allowed). Ensure your browser supports Web Speech and is not offline/restricted.';
        this.emit('mic-status', { status: 'error', message: errorMsg });
        this.emit('error', { message: errorMsg, code: event.error });
        this.stop();
      } else if (event.error === 'language-not-supported') {
        const errorMsg = 'Language "en-US" is not supported by your browser\'s speech engine.';
        this.emit('mic-status', { status: 'error', message: errorMsg });
        this.emit('error', { message: errorMsg, code: event.error });
        this.stop();
      } else if (event.error === 'audio-capture') {
        const errorMsg = 'Audio capture failed. Ensure your microphone is plugged in, active, and not in use by another program.';
        this.emit('mic-status', { status: 'error', message: errorMsg });
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
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[SpeechService @ ${timestamp}] Activating speech recognition pipeline (start)`);
    this.isListening = true;
    this.isPaused = false;
    
    // Keep hardware microphone monitoring active
    await this.startAudioMonitoring(deviceId);

    // Cleanly tear down any existing browser SpeechRecognition channels first
    this.teardownSpeechRecognition();

    // Use a brief delay to let the browser release the speech port to avoid race conflicts
    setTimeout(() => {
      if (!this.isListening || this.isPaused) {
        console.log('[SpeechService] start aborted: session stopped during initial delay');
        return;
      }

      this.init();
      
      try {
        this.recognition.start();
        const startTs = new Date().toLocaleTimeString();
        console.log(`[SpeechService @ ${startTs}] Recognition engine listening successfully`);
      } catch (e) {
        console.warn('[SpeechService] Engine start failed, queueing reconnect:', e.message);
        this.reconnect();
      }
    }, 150);
  }

  stop() {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[SpeechService @ ${timestamp}] Disabling speech recognition pipeline (stop)`);
    this.isListening = false;
    this.isPaused = false;
    
    this.teardownSpeechRecognition();
    this.stopAudioMonitoring();
    this.emit('status', { status: 'stopped' });
  }

  pause() {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[SpeechService @ ${timestamp}] Pausing speech recognition client (pause)`);
    this.isPaused = true;
    
    this.teardownSpeechRecognition();
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
