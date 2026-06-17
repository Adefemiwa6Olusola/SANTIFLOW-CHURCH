import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useAppStore from '../../store/appStore';
import speechService from '../../services/speechService';

import { fetchVerse } from '../../services/bibleService';

function ScriptureMatchCard({ match, activeTranslation, onProject }) {
  const [verseText, setVerseText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchVerse(activeTranslation, match.book, match.chapter, match.verseStart, match.verseEnd)
      .then(data => {
        if (active) {
          setVerseText(data.text);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [match, activeTranslation]);

  return (
    <motion.div
      whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.06)' }}
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        if (verseText) {
          onProject({
            reference: `${match.book} ${match.chapter}:${match.verseStart}${match.verseEnd && match.verseEnd !== match.verseStart ? `-${match.verseEnd}` : ''}`,
            text: verseText,
            book: match.book,
            chapter: match.chapter,
            verseStart: match.verseStart,
            verseEnd: match.verseEnd,
            translation: activeTranslation
          });
        }
      }}
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 8,
        padding: '8px 10px',
        marginBottom: 6,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#f5c842' }}>
          {match.book} {match.chapter}:{match.verseStart}
        </span>
        <span style={{ fontSize: 8, color: match.confidence >= 0.85 ? '#22c55e' : '#f59e0b', background: 'rgba(255,255,255,0.04)', padding: '1px 4px', borderRadius: 3 }}>
          {Math.round(match.confidence * 100)}%
        </span>
      </div>
      {loading ? (
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Loading scripture...</span>
      ) : (
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, fontStyle: 'italic' }}>
          "{verseText || 'Text not found'}"
        </p>
      )}
    </motion.div>
  );
}

export default function VoicePanel() {
  const voiceStatus = useAppStore(s => s.voiceStatus);
  const aiStatus = useAppStore(s => s.aiStatus);
  const transcriptEntries = useAppStore(s => s.transcriptEntries);
  const interimText = useAppStore(s => s.interimText);
  const sessionStartTime = useAppStore(s => s.sessionStartTime);
  const setVoiceStatus = useAppStore(s => s.setVoiceStatus);
  const addTranscript = useAppStore(s => s.addTranscript);
  const setInterimText = useAppStore(s => s.setInterimText);
  const appendToBuffer = useAppStore(s => s.appendToBuffer);
  const clearTranscript = useAppStore(s => s.clearTranscript);
  const setSessionStartTime = useAppStore(s => s.setSessionStartTime);
  const currentVerse = useAppStore(s => s.currentVerse);
  const detectedScriptures = useAppStore(s => s.detectedScriptures);
  const activeTranslation = useAppStore(s => s.activeTranslation);
  const speechEngine = useAppStore(s => s.speechEngine);
  const deepgramApiKey = useAppStore(s => s.deepgramApiKey);
  
  const scrollRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);
  const [btnHovered, setBtnHovered] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  // Track session start time in a ref so it NEVER resets during reconnects
  const sessionStartRef = useRef(null);
  const timerRef = useRef(null);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);


  // Timer: runs continuously once session starts, never resets on reconnect
  useEffect(() => {
    if (voiceStatus === 'listening' || voiceStatus === 'connecting' || voiceStatus === 'reconnecting') {
      // First time going live — set start ref once
      if (!sessionStartRef.current) {
        sessionStartRef.current = Date.now();
        setSessionStartTime(sessionStartRef.current);
      }
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setElapsed(Math.floor((Date.now() - sessionStartRef.current) / 1000));
        }, 1000);
      }
    } else if (voiceStatus === 'stopped' || voiceStatus === 'error') {
      // Only clear timer when user explicitly stops
      clearInterval(timerRef.current);
      timerRef.current = null;
      sessionStartRef.current = null;
      setElapsed(0);
    }
    return () => {};
  }, [voiceStatus]);

  useEffect(() => {
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
      // DO NOT reset sessionStartTime here — timer is managed by sessionStartRef above
    });

    const unsubError = (data) => {
      console.error('[VoicePanel] Speech engine reported error:', data.message);
      setErrorMessage(data.message);
      useAppStore.getState().addToast({ type: 'error', message: data.message });
      setVoiceStatus('error');
    };
    const unsubErrorCleanup = speechService.on('error', unsubError);

    const unsubMicStatus = speechService.on('mic-status', (data) => {
      if (data.status === 'error' || data.status === 'blocked') {
        setErrorMessage(data.message);
      }
    });

    return () => {
      unsubTranscript();
      unsubInterim();
      unsubStatus();
      unsubErrorCleanup();
      unsubMicStatus();
    };
  }, []);

  // Scroll transcript panel on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptEntries, interimText]);

  const handleToggle = async () => {
    const usingDeepgram = speechEngine === 'deepgram';
    if (!usingDeepgram && !isSupported) {
      useAppStore.getState().addToast({
        type: 'error',
        message: '⚠ Native browser voice recognition requires Chrome or Edge'
      });
      return;
    }

    if (voiceStatus === 'listening' || voiceStatus === 'connecting' || voiceStatus === 'reconnecting') {
      console.log('[VoicePanel] Stopping recording');
      speechService.stop();
    } else {
      console.log('[VoicePanel] Starting recording');
      setErrorMessage('');
      // Configure engine settings before starting speechService
      speechService.engineType = speechEngine;
      speechService.deepgramApiKey = deepgramApiKey;
      // Always use system default mic so Web Speech API and audio monitoring are in sync
      await speechService.start(null);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleProject = (verse) => {
    if (window.__sf && window.__sf.project) {
      window.__sf.project(verse);
    }
  };

  const isListeningActive = voiceStatus === 'listening';
  const isConnecting = voiceStatus === 'connecting' || voiceStatus === 'reconnecting';
  const isProcessing = aiStatus === 'processing';
  const isError = voiceStatus === 'error' || aiStatus === 'error';
  const isPaused = voiceStatus === 'paused';
  // Session is active as long as it hasn't been explicitly stopped
  const isSessionActive = isListeningActive || isConnecting;

  const statusColor =
    isError ? '#ef4444' :
    isProcessing ? '#a855f7' :
    isSessionActive ? '#22c55e' :  // Green for ALL active states (connecting treated as active)
    isPaused ? '#f5c842' : '#64748b';

  // Only show visible state — never expose Connecting/Reconnecting to operator
  const statusText =
    isError ? 'Error' :
    isProcessing ? 'AI Active' :
    isSessionActive ? 'Listening' :   // Reconnects are invisible
    isPaused ? 'Paused' : 'Ready';

  const isActive = isSessionActive;
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
          {/* Animated pulsing status dot */}
          <motion.span
            animate={
              isListeningActive || isConnecting || isProcessing
                ? { scale: [1, 1.25, 1], opacity: [0.8, 1, 0.8] }
                : {}
            }
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
              background: statusColor,
              boxShadow: `0 0 10px ${statusColor}`,
              transition: 'background 0.3s ease'
            }}
          />
          <span style={{ fontWeight: 700, fontSize: 13, color: 'white', letterSpacing: '0.02em' }}>🎙 Live Transcript</span>
          
          {/* Current Status Badge */}
          <span style={{
            fontSize: 10, color: 'rgba(255,255,255,0.7)',
            background: 
              isError ? 'rgba(239,68,68,0.12)' :
              isProcessing ? 'rgba(168,85,247,0.12)' :
              isListeningActive ? 'rgba(34,197,94,0.12)' :
              isConnecting ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
            padding: '2px 8px', borderRadius: 5,
            fontWeight: 600, 
            border: `1px solid ${
              isError ? 'rgba(239,68,68,0.2)' :
              isProcessing ? 'rgba(168,85,247,0.2)' :
              isListeningActive ? 'rgba(34,197,94,0.2)' :
              isConnecting ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)'
            }`,
            transition: 'all 0.3s ease'
          }}>
            {statusText}
          </span>

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
          <motion.button
            onClick={handleToggle}
            onMouseEnter={() => setBtnHovered(true)}
            onMouseLeave={() => setBtnHovered(false)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            animate={
              isSessionActive
                ? {
                    background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                    boxShadow: [
                      '0 0 12px rgba(239, 68, 68, 0.3)',
                      '0 0 24px rgba(239, 68, 68, 0.6)',
                      '0 0 12px rgba(239, 68, 68, 0.3)'
                    ],
                  }
                : {
                    background: 'linear-gradient(135deg, #f5c842, #e07b39)',
                    boxShadow: '0 0 12px rgba(245, 200, 66, 0.2)',
                  }
            }
            transition={
              isSessionActive
                ? {
                    boxShadow: {
                      repeat: Infinity,
                      duration: 2,
                      ease: 'easeInOut',
                    },
                    background: { duration: 0.3 }
                  }
                : { duration: 0.3 }
            }
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.03em',
              color: isSessionActive ? '#ffffff' : '#1a1000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none',
              minWidth: 140,
              height: 36,
            }}
            id="voice-toggle-btn"
          >
            {/* Left-side Icon depending on status */}
            {isSessionActive ? (
              <>
                {/* Pulsing Recording Indicator Dot */}
                <div style={{ position: 'relative', width: 8, height: 8, marginRight: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <motion.div
                    animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                    style={{ position: 'absolute', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ffffff' }}
                  />
                  <div style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: '#ffffff' }} />
                </div>
              </>
            ) : (
              <span style={{ marginRight: 6, fontSize: 13 }}>🎤</span>
            )}

            {/* Button Text */}
            <span>
              {isSessionActive
                ? (btnHovered ? 'Stop Listening' : 'Listening')
                : 'Listen'}
            </span>
          </motion.button>
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
      {speechEngine === 'browser' && !isSupported && (
        <div style={{
          padding: '8px 16px', fontSize: 11,
          background: 'rgba(239,68,68,0.1)', color: '#ef4444',
          borderBottom: '1px solid rgba(239,68,68,0.2)',
          flexShrink: 0,
        }}>
          ⚠ Voice recognition requires Google Chrome or Microsoft Edge
        </div>
      )}

      {/* Body Area: Split into Live Transcript (left) and Real-time Matches (right) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Transcript Area */}
        <div ref={scrollRef} style={{ flex: 1.6, overflowY: 'auto', padding: '12px 16px', fontSize: 13, borderRight: '1px solid hsla(255,255,255,0.06)' }}>
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
                <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 4, lineHeight: 1.6 }}>
                  <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10, marginRight: 8, fontFamily: 'monospace' }}>
                    --:--:--
                  </span>
                  <span style={{ color: 'rgba(245,200,66,0.75)', fontStyle: 'italic' }}>
                    {interimText}...
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Scripture Matches Sidebar */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, flexShrink: 0 }}>
            📖 Scripture Matches
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {detectedScriptures.length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', fontSize: 11, paddingTop: 40 }}>
                No scriptures detected yet.
              </div>
            ) : (
              detectedScriptures.map((match, idx) => (
                <ScriptureMatchCard
                  key={match._id || `${match.book}-${match.chapter}-${match.verseStart}-${idx}`}
                  match={match}
                  activeTranslation={activeTranslation}
                  onProject={handleProject}
                />
              ))
            )}
          </div>
        </div>
      </div>
      {/* ✨ NOW SHOWING — Bible Verse Card */}
      <AnimatePresence>
        {currentVerse && (
          <motion.div
            key={`${currentVerse.book}-${currentVerse.chapter}-${currentVerse.verseStart}`}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{
              margin: '0 12px 12px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(245,200,66,0.08) 100%)',
              border: '1px solid rgba(168,85,247,0.3)',
              padding: '12px 14px',
              boxShadow: '0 0 20px rgba(168,85,247,0.15)',
              flexShrink: 0,
            }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                style={{ fontSize: 16 }}>📖</motion.span>
              <span style={{
                fontSize: 13, fontWeight: 800,
                background: 'linear-gradient(90deg, #a855f7, #f5c842)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                letterSpacing: '0.03em'
              }}>
                {currentVerse.reference}
              </span>
              <span style={{
                marginLeft: 'auto', fontSize: 9, fontWeight: 700,
                color: '#a855f7', background: 'rgba(168,85,247,0.12)',
                padding: '2px 7px', borderRadius: 4,
                border: '1px solid rgba(168,85,247,0.2)', textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                {currentVerse.translation || 'KJV'}
              </span>
            </div>
            {/* Verse text */}
            <p style={{
              margin: 0, fontSize: 12, lineHeight: 1.65,
              color: 'rgba(255,255,255,0.88)', fontStyle: 'italic',
              borderLeft: '2px solid rgba(168,85,247,0.4)',
              paddingLeft: 10
            }}>
              "{currentVerse.text || currentVerse.verses?.map(v => v.text).join(' ')}"
            </p>
            {currentVerse.confidence && (
              <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                AI confidence: {Math.round(currentVerse.confidence * 100)}%
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
