import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useAppStore from '../../store/appStore';
import speechService from '../../services/speechService';

export default function VoicePanel() {
  const voiceStatus = useAppStore(s => s.voiceStatus);
  const transcriptEntries = useAppStore(s => s.transcriptEntries);
  const interimText = useAppStore(s => s.interimText);
  const sessionStartTime = useAppStore(s => s.sessionStartTime);
  const setVoiceStatus = useAppStore(s => s.setVoiceStatus);
  const addTranscript = useAppStore(s => s.addTranscript);
  const setInterimText = useAppStore(s => s.setInterimText);
  const appendToBuffer = useAppStore(s => s.appendToBuffer);
  const clearTranscript = useAppStore(s => s.clearTranscript);
  const setSessionStartTime = useAppStore(s => s.setSessionStartTime);
  
  const scrollRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);
  
  // Audio configuration & level meter states
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [micStatus, setMicStatus] = useState({ status: 'idle', message: 'Microphone ready' });
  const [errorMessage, setErrorMessage] = useState('');

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Timer logic for live display
  useEffect(() => {
    if (voiceStatus === 'listening') {
      const interval = setInterval(() => {
        if (sessionStartTime) {
          setElapsed(Math.floor((Date.now() - sessionStartTime) / 1000));
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsed(0);
    }
  }, [voiceStatus, sessionStartTime]);

  // Load available audio input devices
  const loadDevices = async () => {
    const devList = await speechService.getAudioDevices();
    setDevices(devList);
    if (devList.length > 0 && !selectedDevice) {
      setSelectedDevice(devList[0].deviceId);
    }
  };

  useEffect(() => {
    // Initial devices enumeration
    loadDevices();

    // Listen to Speech events
    const unsubTranscript = speechService.on('transcript', (data) => {
      console.log('[VoicePanel] Final transcript received:', data.text);
      addTranscript({ text: data.text });
      appendToBuffer(data.text);
      setInterimText('');
    });

    const unsubInterim = speechService.on('interim', (data) => {
      setInterimText(data.text);
    });

    const unsubStatus = speechService.on('status', (data) => {
      setVoiceStatus(data.status);
      if (data.status === 'listening') {
        setSessionStartTime(Date.now());
        setErrorMessage(''); // Clear errors when starting successfully
      }
    });

    const unsubError = (data) => {
      console.error('[VoicePanel] Speech engine reported error:', data.message);
      setErrorMessage(data.message);
      useAppStore.getState().addToast({ type: 'error', message: data.message });
      setVoiceStatus('error');
    };
    const unsubErrorCleanup = speechService.on('error', unsubError);

    // Listen to Web Audio API monitoring events
    const unsubAudioLevel = speechService.on('audio-level', (data) => {
      setAudioLevel(data.level);
    });

    const unsubMicStatus = speechService.on('mic-status', (data) => {
      console.log('[VoicePanel] Mic status updated:', data.status, data.message);
      setMicStatus(data);
      if (data.status === 'error' || data.status === 'blocked') {
        setErrorMessage(data.message);
      }
    });

    const unsubDevices = speechService.on('devices-updated', (devs) => {
      setDevices(devs);
    });

    return () => {
      unsubTranscript();
      unsubInterim();
      unsubStatus();
      unsubErrorCleanup();
      unsubAudioLevel();
      unsubMicStatus();
      unsubDevices();
    };
  }, [selectedDevice]);

  // Scroll transcript panel on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptEntries, interimText]);

  const handleToggle = async () => {
    if (!isSupported) {
      useAppStore.getState().addToast({
        type: 'error',
        message: '⚠ Voice requires Chrome or Edge browser'
      });
      return;
    }

    if (voiceStatus === 'listening') {
      console.log('[VoicePanel] User clicked to Pause listening');
      speechService.pause();
    } else {
      console.log('[VoicePanel] User clicked to Start listening with device:', selectedDevice);
      setErrorMessage('');
      await speechService.start(selectedDevice || null);
    }
  };

  const handleDeviceChange = async (e) => {
    const newDeviceId = e.target.value;
    setSelectedDevice(newDeviceId);
    console.log('[VoicePanel] Audio input device changed to:', newDeviceId);
    
    // If currently listening, hot-swap the stream monitoring and audio capture
    if (voiceStatus === 'listening') {
      speechService.stop();
      setTimeout(async () => {
        await speechService.start(newDeviceId);
      }, 300);
    } else {
      // Just test the stream to check permissions
      await speechService.startAudioMonitoring(newDeviceId);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isActive = voiceStatus === 'listening';
  const wordCount = transcriptEntries.reduce((acc, e) => acc + (e.text?.split(' ').length || 0), 0);

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'hsla(222,40%,10%,0.8)',
      border: '1px solid hsla(255,255,255,0.06)',
      borderRadius: 14, backdropFilter: 'blur(20px)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid hsla(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
            background: isActive ? '#22c55e' : voiceStatus === 'paused' ? '#e2a13c' : voiceStatus === 'error' ? '#ef4444' : '#64748b',
            boxShadow: isActive ? '0 0 10px #22c55e' : 'none',
            transition: 'all 0.3s ease'
          }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: 'white', letterSpacing: '0.02em' }}>🎙 Live Transcript</span>
          {isActive && (
            <span style={{ fontSize: 11, color: '#f5c842', fontFamily: 'monospace', background: 'rgba(245,200,66,0.1)', padding: '1px 6px', borderRadius: 4 }}>
              {formatTime(elapsed)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {transcriptEntries.length > 0 && (
            <button
              onClick={clearTranscript}
              title="Clear transcript history"
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 11,
                padding: '4px 8px', borderRadius: 6, transition: 'all 0.2s',
                marginRight: 4
              }}
              onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.04)'}
            >Clear</button>
          )}
          <button
            onClick={handleToggle}
            style={{
              padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 12, letterSpacing: '0.03em',
              background: isActive
                ? 'rgba(239,68,68,0.2)'
                : 'linear-gradient(135deg, #f5c842, #e07b39)',
              color: isActive ? '#ef4444' : '#1a1000',
              boxShadow: isActive ? 'none' : '0 0 16px rgba(245,200,66,0.3)',
              transition: 'all 0.2s ease',
            }}
            id="voice-toggle-btn"
          >
            {isActive ? '⏸ Pause' : '🎤 Listen'}
          </button>
        </div>
      </div>

      {/* Audio Setup and Diagnostics Panel */}
      <div style={{
        padding: '10px 16px',
        background: 'rgba(255,255,255,0.02)',
        borderBottom: '1px solid hsla(255,255,255,0.04)',
        display: 'flex', flexDirection: 'column', gap: 8,
        flexShrink: 0
      }}>
        {/* Device Selection Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>INPUT:</label>
          <select
            value={selectedDevice}
            onChange={handleDeviceChange}
            style={{
              flex: 1,
              maxWidth: '80%',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6,
              color: 'rgba(255,255,255,0.8)',
              fontSize: 11,
              padding: '4px 6px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {devices.length === 0 ? (
              <option value="">Default Microphone</option>
            ) : (
              devices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microphone ${d.deviceId.slice(0, 5)}...`}
                </option>
              ))
            )}
          </select>
          <button
            onClick={loadDevices}
            title="Refresh device list"
            style={{
              background: 'none', border: 'none', color: '#f5c842', cursor: 'pointer', fontSize: 13
            }}
          >
            🔄
          </button>
        </div>

        {/* Volume Level Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, minWidth: 40 }}>VOLUME:</span>
          <div style={{
            flex: 1,
            height: 6,
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 3,
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* Level Bar */}
            <motion.div
              animate={{ width: `${audioLevel * 100}%` }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              style={{
                height: '100%',
                borderRadius: 3,
                background: audioLevel > 0.8
                  ? 'linear-gradient(90deg, #22c55e, #e2a13c, #ef4444)'
                  : audioLevel > 0.5
                    ? 'linear-gradient(90deg, #22c55e, #e2a13c)'
                    : '#22c55e',
                boxShadow: audioLevel > 0.1 ? '0 0 8px rgba(34,197,94,0.5)' : 'none'
              }}
            />
          </div>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', minWidth: 25, textAlign: 'right' }}>
            {Math.round(audioLevel * 100)}%
          </span>
        </div>
      </div>

      {/* Error / Warning Alert Banner */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{
              padding: '10px 16px',
              background: 'rgba(239,68,68,0.15)',
              borderBottom: '1px solid rgba(239,68,68,0.25)',
              color: '#fca5a5',
              fontSize: 12,
              lineHeight: 1.4,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8
            }}
          >
            <span style={{ fontSize: 14 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#f87171', marginBottom: 2 }}>Audio Connection Issue</div>
              <div>{errorMessage}</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  onClick={async () => {
                    setErrorMessage('');
                    await handleToggle();
                  }}
                  style={{
                    background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 4, color: '#fff', fontSize: 10, padding: '2px 8px', cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  Retry Connection
                </button>
                <button
                  onClick={() => setErrorMessage('')}
                  style={{
                    background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 10,
                    cursor: 'pointer', textDecoration: 'underline'
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Browser compatibility warning */}
      {!isSupported && (
        <div style={{
          padding: '8px 16px', fontSize: 11,
          background: 'rgba(239,68,68,0.1)', color: '#ef4444',
          borderBottom: '1px solid rgba(239,68,68,0.2)',
          flexShrink: 0,
        }}>
          ⚠ Voice recognition requires Google Chrome or Microsoft Edge
        </div>
      )}

      {/* Transcript Body */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', fontSize: 13 }}>
        {transcriptEntries.length === 0 && !interimText ? (
          <div style={{ color: 'rgba(255,255,255,0.25)', textAlign: 'center', paddingTop: 32 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎙️</div>
            <p style={{ fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
              Click Listen to begin
            </p>
            <p style={{ fontSize: 11, lineHeight: 1.6 }}>
              Preach naturally. The AI will detect scriptures in real time.
            </p>
            <div style={{
              marginTop: 18, padding: '12px 14px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: 10, textAlign: 'left', fontSize: 11, lineHeight: 1.8,
            }}>
              <div style={{ color: '#f5c842', fontWeight: 700, marginBottom: 6 }}>Try saying:</div>
              <div>"For God so loved the world…"</div>
              <div>"The Lord is my shepherd…"</div>
              <div>"Walk by faith not by sight"</div>
              <div>"Switch to NIV" / "Next verse"</div>
            </div>
          </div>
        ) : (
          <>
            {transcriptEntries.map(entry => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginBottom: 8, lineHeight: 1.6 }}
              >
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginRight: 8, fontFamily: 'monospace' }}>
                  {entry.timestamp}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.85)' }}>{entry.text}</span>
              </motion.div>
            ))}
            {interimText && (
              <div style={{
                color: '#f5c842',
                fontStyle: 'italic',
                fontSize: 12,
                marginTop: 4,
                opacity: 0.8,
                background: 'rgba(245,200,66,0.05)',
                padding: '4px 8px',
                borderRadius: 6,
                display: 'inline-block'
              }}>
                🎤 {interimText}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
