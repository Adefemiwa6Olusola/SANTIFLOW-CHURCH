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

    // Reconnection state — always instant (50ms) to avoid mic gaps
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 50;
    this.baseReconnectDelay = 50;

    // Speech Engine configuration
    this.engineType = 'browser'; // 'browser' | 'deepgram'
    this.deepgramApiKey = null;
    this.socket = null;
    this.mediaRecorder = null;
    this.silenceTimeout = null;
  }

  teardownSpeechRecognition() {
    clearTimeout(this.restartTimeout);
    clearTimeout(this.silenceTimeout);
    
    // Close Deepgram WebSocket connection
    if (this.socket) {
      console.log('[SpeechService] Closing Deepgram WebSocket connection');
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
      try {
        this.socket.close();
      } catch (e) {}
      this.socket = null;
    }
    
    // Stop Deepgram MediaRecorder
    if (this.mediaRecorder) {
      console.log('[SpeechService] Stopping Deepgram MediaRecorder');
      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch (e) {}
      this.mediaRecorder = null;
    }

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
        audio: deviceId ? {
          deviceId: { exact: deviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      console.log('[SpeechService] Starting microphone stream monitoring:', constraints);
      try {
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        if (deviceId) {
          console.warn('[SpeechService] getUserMedia with exact deviceId failed, falling back to default microphone:', firstErr.message);
          this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
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

      // Acoustic enhancement / preprocessing graph for far-field capture (10+ meters)
      // 1. Highpass filter to eliminate HVAC/low-frequency room rumble under 80Hz
      this.highpassFilter = this.audioContext.createBiquadFilter();
      this.highpassFilter.type = 'highpass';
      this.highpassFilter.frequency.value = 80;

      // 2. Dynamics compressor to act as auto-gain control, boosting quiet far-field vocals
      this.compressor = this.audioContext.createDynamicsCompressor();
      this.compressor.threshold.value = -24; // start compressing at -24dB
      this.compressor.knee.value = 30;       // soft knee
      this.compressor.ratio.value = 12;      // strong compression to boost quiet parts
      this.compressor.attack.value = 0.003;  // fast attack (3ms)
      this.compressor.release.value = 0.25;  // release (250ms)

      // 3. GainNode for adaptive digital gain normalization
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 2.0; // start with a 2x sensitivity boost

      // 4. Media stream destination for the preprocessed stream
      this.destination = this.audioContext.createMediaStreamDestination();

      // Connect nodes: source -> highpassFilter -> compressor -> gainNode -> destination
      this.source.connect(this.highpassFilter);
      this.highpassFilter.connect(this.compressor);
      this.compressor.connect(this.gainNode);
      this.gainNode.connect(this.destination);
      
      // Feed preprocessed stream into the analyser for visual level detection
      this.gainNode.connect(this.analyser);

      this.processedStream = this.destination.stream;

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

        // Adaptive normalization: adjust gain dynamically based on average voice power
        if (this.audioContext && this.gainNode) {
          let targetGain = 2.0;
          if (average > 0 && average < 20) {
            targetGain = 3.5; // 3.5x gain boost for very quiet/distant speech
          } else if (average >= 20 && average < 55) {
            targetGain = 2.0; // 2x gain boost for medium/normal speaking
          } else if (average > 100) {
            targetGain = 0.5; // lower gain for loud/close shouting to prevent distortion
          }
          // Smooth gain adjustment over 100ms
          this.gainNode.gain.setTargetAtTime(targetGain, this.audioContext.currentTime, 0.1);
        }

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
    this.highpassFilter = null;
    this.compressor = null;
    this.gainNode = null;
    this.destination = null;
    this.processedStream = null;
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
    this.recognition.lang = '';           // System locale — avoids language rejection
    this.recognition.maxAlternatives = 3;

    // Boost recognition of Bible vocabulary using SpeechGrammarList
    try {
      const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
      if (SpeechGrammarList) {
        const grammarList = new SpeechGrammarList();
        const bibleGrammar = `#JSGF V1.0; grammar bible;
          public <book> = genesis | exodus | leviticus | numbers | deuteronomy |
            joshua | judges | ruth | samuel | kings | chronicles | ezra | nehemiah |
            esther | job | psalms | psalm | proverbs | ecclesiastes | isaiah | jeremiah |
            lamentations | ezekiel | daniel | hosea | joel | amos | obadiah | jonah |
            micah | nahum | habakkuk | zephaniah | haggai | zechariah | malachi |
            matthew | mark | luke | john | acts | romans | corinthians | galatians |
            ephesians | philippians | colossians | thessalonians | timothy | titus |
            philemon | hebrews | james | peter | jude | revelation |
            praise the lord | hallelujah | amen | blessed | holy spirit | jesus | christ |
            faith | hope | love | salvation | grace | mercy | gospel | scripture;
        `;
        grammarList.addFromString(bibleGrammar, 1);
        this.recognition.grammars = grammarList;
      }
    } catch (e) {
      // Grammar API not supported — continue without it
    }

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
        const alternative = event.results[i][0];
        const transcript = alternative.transcript;
        const confidence = alternative.confidence || 0;

        // Skip low confidence text to reduce transcription errors
        if (confidence > 0 && confidence < 0.45) {
          console.log(`[SpeechService] Skipped low-confidence native transcript (${confidence}): "${transcript}"`);
          continue;
        }

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

        // Silence-based auto-finalization restart for native SpeechRecognition:
        // If the speaker pauses for 1.5 seconds, stop the engine to force immediate finalization and restart.
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = setTimeout(() => {
          if (this.isListening && !this.isPaused && this.recognition) {
            console.log('[SpeechService] Silence detected in interim speech. Restarting engine to finalize transcript...');
            try {
              this.recognition.stop();
            } catch (e) {}
          }
        }, 1500);
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
        // Silently restart — do NOT show any status change to the user
        // This keeps the timer running and UI stable during natural pauses
        this.reconnect();
        return; // skip status emit entirely
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

  startDeepgram() {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[SpeechService @ ${timestamp}] Connecting to Deepgram streaming API`);

    const apiKey = this.deepgramApiKey || (typeof window !== 'undefined' && localStorage.getItem('sanctiflow_deepgram_api_key'));
    if (!apiKey) {
      const errorMsg = 'Deepgram API Key is missing. Please enter it in Settings.';
      this.emit('error', { message: errorMsg });
      this.emit('status', { status: 'stopped' });
      return;
    }

    if (!this.stream) {
      const errorMsg = 'Audio stream not initialized. Cannot stream to Deepgram.';
      this.emit('error', { message: errorMsg });
      this.emit('status', { status: 'stopped' });
      return;
    }

    try {
      // Deepgram Streaming WebSocket endpoint (reduced endpointing for faster turnaround)
      const url = `wss://api.deepgram.com/v1/listen?smart_format=true&interim_results=true&model=nova-2-general&language=en&endpointing=300`;
      this.socket = new WebSocket(url, ['token', apiKey]);

      this.socket.onopen = () => {
        console.log('[SpeechService] Deepgram WebSocket connection established');
        this.emit('status', { status: 'listening' });

        try {
          // Initialize MediaRecorder to stream containerized audio
          let options = { mimeType: 'audio/webm' };
          if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported('audio/webm')) {
            if (MediaRecorder.isTypeSupported('audio/ogg')) {
              options = { mimeType: 'audio/ogg' };
            } else {
              options = {}; // browser default
            }
          }

          this.mediaRecorder = new MediaRecorder(this.processedStream || this.stream, options);
          this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0 && this.socket && this.socket.readyState === WebSocket.OPEN) {
              this.socket.send(event.data);
            }
          };

          // Stream audio in 100ms slices (reduced from 200ms) for faster transcription updates
          this.mediaRecorder.start(100);
          console.log('[SpeechService] MediaRecorder streaming started');
        } catch (mediaErr) {
          console.error('[SpeechService] MediaRecorder start failed:', mediaErr);
          this.emit('error', { message: `MediaRecorder failed: ${mediaErr.message}` });
          this.stop();
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.channel && data.channel.alternatives && data.channel.alternatives[0]) {
            const transcript = data.channel.alternatives[0].transcript;
            const isFinal = data.is_final;
            const confidence = data.channel.alternatives[0].confidence;

            // Skip low confidence text to reduce transcription errors
            if (confidence > 0 && confidence < 0.45) {
              console.log(`[SpeechService] Skipped low-confidence Deepgram transcript (${confidence}): "${transcript}"`);
              return;
            }

            if (transcript) {
              if (isFinal) {
                this.finalTranscript += transcript + ' ';
                const cleanText = transcript.trim();
                const ts = new Date().toLocaleTimeString();
                console.log(`[SpeechService @ ${ts}] [Deepgram Final] "${cleanText}"`);
                this.emit('transcript', {
                  text: cleanText,
                  fullText: this.finalTranscript.trim(),
                  isFinal: true,
                  confidence: confidence || 0.99
                });
              } else {
                this.emit('interim', {
                  text: transcript.trim(),
                  isFinal: false
                });
              }
            }
          }
        } catch (jsonErr) {
          console.warn('[SpeechService] Error parsing Deepgram WebSocket message:', jsonErr);
        }
      };

      this.socket.onerror = (err) => {
        console.error('[SpeechService] Deepgram WebSocket error:', err);
        this.emit('error', { message: 'Deepgram streaming socket error. Check key or network.' });
      };

      this.socket.onclose = (event) => {
        console.log('[SpeechService] Deepgram WebSocket closed:', event.code, event.reason);
        if (this.isListening && !this.isPaused) {
          console.log('[SpeechService] Reconnecting Deepgram...');
          this.reconnect();
        }
      };

    } catch (err) {
      console.error('[SpeechService] Deepgram connection failed:', err);
      this.emit('error', { message: `Deepgram connection failed: ${err.message}` });
      this.reconnect();
    }
  }

  reconnect() {
    clearTimeout(this.restartTimeout);
    // Use 1.5s delay for Deepgram reconnects to avoid socket hammering, 50ms for native
    const delay = this.engineType === 'deepgram' ? 1500 : 50;

    this.restartTimeout = setTimeout(() => {
      if (this.isListening && !this.isPaused) {
        if (this.engineType === 'deepgram') {
          this.startDeepgram();
        } else {
          if (!this.recognition) {
            this.init();
          }
          try {
            this.recognition.start();
          } catch (e) {
            console.warn('[SpeechService] Start skipped (already running):', e.message);
          }
        }
      }
    }, delay);
  }

  async start(deviceId = null) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[SpeechService @ ${timestamp}] Activating speech recognition pipeline (start) using engine: ${this.engineType}`);
    this.isListening = true;
    this.isPaused = false;
    
    // Keep hardware microphone monitoring active
    await this.startAudioMonitoring(deviceId);

    // Cleanly tear down any existing browser SpeechRecognition/Deepgram channels first
    this.teardownSpeechRecognition();

    if (this.engineType === 'deepgram') {
      this.startDeepgram();
    } else {
      // Browser SpeechRecognition: Use a brief delay to let the browser release the speech port to avoid race conflicts
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
