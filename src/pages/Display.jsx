/**
 * SanctiFlow AUDIENCE DISPLAY SCREEN (/display)
 * 
 * This is the CLEAN audience-facing screen. No operator controls.
 * Only shows: Bible verses, worship backgrounds, cinematic transitions.
 * 
 * Usage:
 *   window.open('/display', 'SanctiFlow_Display', 'width=1920,height=1080')
 * 
 * Sync: BroadcastChannel from operator dashboard → this screen
 */

import { useEffect, useReducer, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { syncService } from '../services/syncService';
import { BACKGROUNDS } from '../utils/constants';

// State shape
const initialState = {
  verse: null,
  background: 'dark',
  theme: 'dark',         // 'dark' | 'light'
  displayMode: 'fullscreen', // 'fullscreen' | 'lower-third' | 'stage' | 'blank'
  fontSize: 1.0,
  textAlign: 'center',
  isBlank: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_VERSE':      return { ...state, verse: action.payload, isBlank: false };
    case 'CLEAR':          return { ...state, verse: null };
    case 'BLANK':          return { ...state, isBlank: !state.isBlank };
    case 'SET_BG':         return { ...state, background: action.payload };
    case 'SET_MODE':       return { ...state, displayMode: action.payload };
    case 'SET_FONT':       return { ...state, fontSize: action.payload };
    case 'SET_ALIGN':      return { ...state, textAlign: action.payload };
    case 'SET_THEME':      return { ...state, theme: action.payload };
    default:               return state;
  }
}

export default function Display() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [lastUpdate, setLastUpdate] = useState(() => Date.now());
  const [showHint, setShowHint] = useState(true);

  // Auto-hide the hint after 4 seconds
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 4000);
    return () => clearTimeout(t);
  }, []);

  // ── Sync subscription ────────────────────────────────────────
  useEffect(() => {
    syncService.init();

    const subs = [
      syncService.on('SYNC_STATE', (state) => {
        if (state.activeVerse) {
          dispatch({ type: 'SET_VERSE', payload: state.activeVerse });
        } else {
          dispatch({ type: 'CLEAR' });
        }
        if (state.background) dispatch({ type: 'SET_BG', payload: state.background });
        if (state.mode) dispatch({ type: 'SET_MODE', payload: state.mode });
        if (state.fontSize && typeof state.fontSize === 'number') dispatch({ type: 'SET_FONT', payload: state.fontSize });
        if (state.align) dispatch({ type: 'SET_ALIGN', payload: state.align });
        if (state.theme) dispatch({ type: 'SET_THEME', payload: state.theme });
      }),
      syncService.on('DISPLAY_VERSE', (data) => {
        dispatch({ type: 'SET_VERSE', payload: null }); // Clear first for re-animation
        setTimeout(() => {
          dispatch({ type: 'SET_VERSE', payload: data });
          setLastUpdate(Date.now());
        }, 60);
      }),
      syncService.on('CLEAR_SCREEN', () => dispatch({ type: 'CLEAR' })),
      syncService.on('CHANGE_BACKGROUND', (d) => dispatch({ type: 'SET_BG', payload: d.background })),
      syncService.on('CHANGE_MODE', (d) => dispatch({ type: 'SET_MODE', payload: d.mode })),
      syncService.on('CHANGE_FONT_SIZE', (d) => dispatch({ type: 'SET_FONT', payload: d.size })),
      syncService.on('CHANGE_ALIGN', (d) => dispatch({ type: 'SET_ALIGN', payload: d.align })),
      syncService.on('CHANGE_THEME', (d) => dispatch({ type: 'SET_THEME', payload: d.theme })),
      syncService.on('PING', () => syncService.broadcast('PONG', { screen: 'display' })),
    ];

    // Keyboard shortcut: F = fullscreen, B = blank toggle, Esc = clear
    const onKey = (e) => {
      if (e.key === 'f' || e.key === 'F') {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
      if (e.key === 'b' || e.key === 'B') {
        dispatch({ type: 'BLANK' });
      }
      if (e.key === 'Escape') {
        dispatch({ type: 'CLEAR' });
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      subs.forEach(unsub => unsub());
      window.removeEventListener('keydown', onKey);
      // Do NOT call syncService.destroy() here — React StrictMode
      // double-mounts effects and destroy() kills the socket permanently
    };
  }, []);

  const { verse, background, displayMode, fontSize, textAlign, theme, isBlank } = state;
  const bg = BACKGROUNDS.find(b => b.id === background);
  const isDark = theme === 'dark';

  // ── Font auto-scaling by text length ────────────────────────
  const getVerseFont = (text) => {
    if (!text) return `calc(3.8rem * ${fontSize})`;
    const len = text.length;
    if (len > 400) return `calc(1.8rem * ${fontSize})`;
    if (len > 300) return `calc(2.2rem * ${fontSize})`;
    if (len > 200) return `calc(2.8rem * ${fontSize})`;
    if (len > 100) return `calc(3.4rem * ${fontSize})`;
    return `calc(4.2rem * ${fontSize})`;
  };

  // ── BLANK SCREEN ─────────────────────────────────────────────
  if (isBlank) {
    return <div style={{ width: '100vw', height: '100vh', background: '#000' }} />;
  }

  // ── LOWER-THIRD MODE (Now centered overlay as requested) ─────
  if (displayMode === 'lower-third') {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '4vw', overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Optional: subtle bg for overlay mode */}
        {bg?.url && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${bg.url})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            opacity: 0.1, zIndex: 0,
          }} />
        )}
        <AnimatePresence>
          {verse && (
            <motion.div
              key={verse.reference + verse.translation}
              initial={{ opacity: 0, scale: 0.96, y: 15, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.02, y: -10, filter: 'blur(6px)' }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'relative',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(8,12,26,0.85) 0%, rgba(3,5,10,0.92) 100%)',
                backdropFilter: 'blur(30px)',
                border: '1px solid rgba(245,200,66,0.25)',
                borderRadius: '24px',
                padding: '36px 48px',
                maxWidth: '82vw',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                boxShadow: '0 24px 80px rgba(0,0,0,0.85), inset 0 0 20px rgba(255,255,255,0.02)',
              }}
            >
              {/* Vibe Background inside the card */}
              {bg?.url && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${bg.url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  opacity: 0.25,
                  zIndex: 0,
                  mixBlendMode: 'color-dodge',
                }} />
              )}
              <p style={{
                fontFamily: '"Outfit", "Inter", sans-serif',
                fontSize: 'clamp(1.6rem, 3.2vw, 3rem)',
                fontWeight: 800,
                lineHeight: 1.45, color: '#fff',
                textAlign: 'center',
                textShadow: '0 4px 20px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.85)',
                margin: '0 0 20px 0',
                position: 'relative',
                zIndex: 1,
              }}>"{verse.text}"</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', position: 'relative', zIndex: 1 }}>
                <span style={{ fontFamily: '"Outfit",sans-serif', fontSize: 'clamp(0.95rem,1.4vw,1.3rem)', fontWeight: 900, color: '#f5c842', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {verse.reference}
                </span>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(245,200,66,0.45)' }} />
                <span style={{ fontFamily: '"Outfit",sans-serif', fontSize: 'clamp(0.85rem,1.1vw,1.1rem)', fontWeight: 600, color: 'rgba(245,200,66,0.6)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                  {verse.translation}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── STAGE MODE — larger reference, smaller verse text ────────
  if (displayMode === 'stage') {
    return (
      <div style={{
        width: '100vw', height: '100vh', overflow: 'hidden',
        position: 'relative', backgroundColor: isDark ? '#060a14' : '#f8f8f4',
      }}>
        {bg?.url && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${bg.url})`,
            backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.3, zIndex: 0,
          }} />
        )}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(248,248,244,0.7)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '5vw',
        }}>
          <AnimatePresence mode="wait">
            {verse && (
              <motion.div
                key={verse.reference}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                style={{ textAlign: 'center' }}
              >
                <div style={{
                  fontFamily: '"Outfit",sans-serif', fontSize: `calc(6rem * ${fontSize})`,
                  fontWeight: 900, color: '#f5c842',
                  textShadow: '0 4px 24px rgba(0,0,0,0.9)',
                  letterSpacing: '-0.02em', marginBottom: '2rem',
                }}>
                  {verse.reference}
                </div>
                <div style={{
                  fontFamily: '"Cormorant Garamond",Georgia,serif',
                  fontSize: `calc(2rem * ${fontSize})`,
                  color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.75)',
                  lineHeight: 1.6, maxWidth: '80vw',
                  textShadow: isDark ? '0 2px 12px rgba(0,0,0,0.8)' : 'none',
                }}>"{verse.text}"</div>
                <div style={{ marginTop: '1.5rem', fontFamily: '"Outfit",sans-serif', fontSize: `calc(1.2rem * ${fontSize})`, color: 'rgba(245,200,66,0.6)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                  {verse.translation}
                </div>
              </motion.div>
            )}
            {!verse && (
              <motion.div key="empty-stage" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ fontFamily: '"Outfit",sans-serif', fontSize: '1rem', color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)', letterSpacing: '0.4em', textTransform: 'uppercase' }}>
                  SanctiFlow · Stage Display
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ── FULLSCREEN MODE (default) ────────────────────────────────
  return (
    <div
      style={{
        width: '100vw', height: '100vh', overflow: 'hidden',
        position: 'relative',
        backgroundColor: isDark ? '#030508' : '#f8f8f4',
        cursor: 'none',
      }}
      onDoubleClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
    >
      {/* Background image */}
      {bg?.url && (
        <motion.div
          key={background}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
          style={{
            position: 'absolute', inset: 0, zIndex: 0,
            backgroundImage: `url(${bg.url})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
          }}
        />
      )}

      {/* Radial gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: isDark
          ? (bg?.url
            ? 'radial-gradient(ellipse 70% 80% at 50% 50%, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.82) 100%)'
            : 'linear-gradient(180deg, hsl(222,47%,4%) 0%, hsl(222,50%,3%) 100%)')
          : 'rgba(248,248,244,0.88)',
      }} />

      {/* Inner vignette */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2,
        boxShadow: 'inset 0 0 180px rgba(0,0,0,0.55)',
        pointerEvents: 'none',
      }} />

      {/* ── VERSE CONTENT ─────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 3,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '6vw',
      }}>
        <AnimatePresence mode="wait">
          {verse ? (
            <motion.div
              key={verse.reference + verse.translation + verse.text.slice(0, 20)}
              initial={{ opacity: 0, scale: 0.975, filter: 'blur(18px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.015, filter: 'blur(10px)' }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              style={{ textAlign, maxWidth: '90vw', width: '100%' }}
            >
              {/* Top ornament */}
              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  height: 2, width: 80,
                  background: 'linear-gradient(90deg, transparent, #f5c842, transparent)',
                  margin: textAlign === 'center' ? '0 auto 3.5vw' : '0 0 3.5vw',
                }}
              />

              {/* Verse text */}
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  fontFamily: '"Cormorant Garamond", Georgia, serif',
                  fontSize: getVerseFont(verse.text),
                  fontWeight: 400,
                  lineHeight: 1.55,
                  color: isDark ? '#ffffff' : '#1a1a1a',
                  textShadow: isDark
                    ? '0 4px 48px rgba(0,0,0,0.98), 0 2px 12px rgba(0,0,0,0.8)'
                    : '0 2px 8px rgba(255,255,255,0.5)',
                  margin: '0 0 3vw 0',
                  letterSpacing: '0.01em',
                }}
              >
                "{verse.text}"
              </motion.p>

              {/* Reference */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                <div style={{
                  fontFamily: '"Outfit", "Inter", sans-serif',
                  fontSize: `calc(1.5rem * ${fontSize})`,
                  fontWeight: 900,
                  color: '#f5c842',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  textShadow: isDark ? '0 2px 16px rgba(0,0,0,0.85)' : 'none',
                  marginBottom: '0.5vw',
                }}>
                  {verse.reference}
                </div>
                <div style={{
                  fontFamily: '"Outfit", "Inter", sans-serif',
                  fontSize: `calc(0.9rem * ${fontSize})`,
                  fontWeight: 500,
                  color: 'rgba(245,200,66,0.5)',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                }}>
                  {verse.translation}
                </div>
              </motion.div>

              {/* Bottom ornament */}
              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  height: 2, width: 80,
                  background: 'linear-gradient(90deg, transparent, #f5c842, transparent)',
                  margin: textAlign === 'center' ? '3.5vw auto 0' : '3.5vw 0 0',
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              style={{ textAlign: 'center' }}
            >
              <div style={{
                fontFamily: '"Outfit", sans-serif',
                fontSize: '1rem',
                color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
                letterSpacing: '0.45em',
                textTransform: 'uppercase',
                userSelect: 'none',
              }}>SanctiFlow</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hint overlay on load */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', bottom: 20, right: 20, zIndex: 10,
              padding: '6px 14px', borderRadius: 8,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
              fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: '"Outfit",sans-serif',
            }}
          >
            Double-click to fullscreen · Press B to blank · F to fullscreen
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
