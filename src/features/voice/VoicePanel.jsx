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
  const timerRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (voiceStatus === 'listening') {
      const interval = setInterval(() => {
        if (sessionStartTime) {
          setElapsed(Math.floor((Date.now() - sessionStartTime) / 1000));
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [voiceStatus, sessionStartTime]);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    const unsubTranscript = speechService.on('transcript', (data) => {
      addTranscript({ text: data.text });
      appendToBuffer(data.text);
      setInterimText('');
    });
    const unsubInterim = speechService.on('interim', (data) => setInterimText(data.text));
    const unsubStatus = speechService.on('status', (data) => {
      setVoiceStatus(data.status);
      if (data.status === 'listening') setSessionStartTime(Date.now());
    });
    const unsubError = speechService.on('error', (data) => {
      useAppStore.getState().addToast({ type: 'error', message: data.message });
      setVoiceStatus('error');
    });
    return () => { unsubTranscript(); unsubInterim(); unsubStatus(); unsubError(); };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptEntries, interimText]);

  const handleToggle = () => {
    if (!isSupported) {
      useAppStore.getState().addToast({
        type: 'error',
        message: '⚠ Voice requires Chrome or Edge browser'
      });
      return;
    }
    if (voiceStatus === 'listening') {
      speechService.pause();
    } else {
      speechService.start();
    }
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
        padding: '10px 14px', borderBottom: '1px solid hsla(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isActive ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 18 }}>
              {[...Array(7)].map((_, i) => (
                <div key={i} style={{
                  width: 3, borderRadius: 2,
                  background: '#f5c842',
                  animation: `audio-wave 1.2s ease-in-out infinite`,
                  animationDelay: `${i * 0.1}s`,
                }} />
              ))}
            </div>
          ) : (
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? '#22c55e' : '#475569' }} />
          )}
          <span style={{ fontWeight: 700, fontSize: 13, color: 'white' }}>🎙 Live Transcript</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {transcriptEntries.length > 0 && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginRight: 4 }}>
              {wordCount} words
            </span>
          )}
          {transcriptEntries.length > 0 && (
            <button
              onClick={clearTranscript}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}
            >✕</button>
          )}
          <button
            onClick={handleToggle}
            style={{
              padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
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

      {/* Browser warning */}
      {!isSupported && (
        <div style={{
          padding: '6px 14px', fontSize: 11,
          background: 'rgba(239,68,68,0.1)', color: '#ef4444',
          borderBottom: '1px solid rgba(239,68,68,0.2)',
          flexShrink: 0,
        }}>
          ⚠ Voice recognition requires Google Chrome or Microsoft Edge
        </div>
      )}

      {/* Transcript Body */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', fontSize: 13 }}>
        {transcriptEntries.length === 0 && !interimText ? (
          <div style={{ color: 'rgba(255,255,255,0.25)', textAlign: 'center', paddingTop: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🎙</div>
            <p style={{ fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
              Click Listen to begin
            </p>
            <p style={{ fontSize: 11, lineHeight: 1.6 }}>
              Preach naturally. The AI will detect scriptures in real time.
            </p>
            <div style={{
              marginTop: 14, padding: '10px 12px',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 10, textAlign: 'left', fontSize: 11, lineHeight: 1.8,
            }}>
              <div style={{ color: '#f5c842', fontWeight: 700, marginBottom: 4 }}>Try saying:</div>
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
                style={{ marginBottom: 6, lineHeight: 1.6 }}
              >
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginRight: 8 }}>
                  {entry.timestamp}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.85)' }}>{entry.text}</span>
              </motion.div>
            ))}
            {interimText && (
              <div style={{ color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', fontSize: 12 }}>
                {interimText}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
