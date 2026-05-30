import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { syncService } from '../services/syncService';
import { BACKGROUNDS } from '../utils/constants';

export default function Projection() {
  const [verse, setVerse] = useState(null);
  const [background, setBackground] = useState('dark');
  const [fontSize, setFontSize] = useState(1.0);
  const [mode, setMode] = useState('fullscreen'); // 'fullscreen' | 'lower-third' | 'stage'
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    syncService.init();
    const unsubSyncState = syncService.on('SYNC_STATE', (state) => {
      if (state.activeVerse) setVerse(state.activeVerse);
      else setVerse(null);
      if (state.background) setBackground(state.background);
      if (state.fontSize && typeof state.fontSize === 'number') setFontSize(state.fontSize);
      if (state.mode) setMode(state.mode);
    });
    const unsubVerse = syncService.on('DISPLAY_VERSE', (data) => {
      setVerse(null);
      setTimeout(() => setVerse(data), 80);
    });
    const unsubClear = syncService.on('CLEAR_SCREEN', () => setVerse(null));
    const unsubBg = syncService.on('CHANGE_BACKGROUND', (data) => setBackground(data.background));
    const unsubFont = syncService.on('CHANGE_FONT_SIZE', (data) => setFontSize(data.size));
    const unsubMode = syncService.on('CHANGE_MODE', (data) => setMode(data.mode));
    return () => {
      unsubSyncState();
      unsubVerse();
      unsubClear();
      unsubBg();
      unsubFont();
      unsubMode();
      // Do NOT call syncService.destroy() here — React StrictMode
      // double-mounts effects and destroy() kills the socket permanently
    };
  }, []);

  const bg = BACKGROUNDS.find(b => b.id === background);

  // Auto-scale font based on text length
  const getVerseFont = (text) => {
    if (!text) return `calc(3.5rem * ${fontSize})`;
    const len = text.length;
    if (len > 350) return `calc(2rem * ${fontSize})`;
    if (len > 250) return `calc(2.6rem * ${fontSize})`;
    if (len > 150) return `calc(3.2rem * ${fontSize})`;
    return `calc(4rem * ${fontSize})`;
  };

  const getReferenceFont = () => `calc(1.4rem * ${fontSize})`;

  // LOWER-THIRD MODE (Now centered overlay as requested)
  if (mode === 'lower-third') {
    return (
      <div style={{
        width: '100vw', height: '100vh', overflow: 'hidden',
        background: 'transparent', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '4vw',
      }}>
        <AnimatePresence>
          {verse && (
            <motion.div
              key={verse.reference}
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
                lineHeight: 1.45, color: '#ffffff',
                textAlign: 'center',
                textShadow: '0 4px 20px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.85)',
                margin: '0 0 20px 0',
                position: 'relative',
                zIndex: 1,
              }}>
                "{verse.text}"
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', position: 'relative', zIndex: 1 }}>
                <span style={{ fontFamily: '"Outfit",sans-serif', fontSize: 'clamp(0.95rem,1.4vw,1.3rem)', fontWeight: 900, color: '#f5c842', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {verse.reference}
                </span>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(245,200,66,0.45)' }} />
                <span style={{ fontFamily: '"Outfit",sans-serif', fontSize: 'clamp(0.85rem,1.1vw,1.1rem)', fontWeight: 600, color: 'rgba(245,200,66,0.55)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                  {verse.translation}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // FULLSCREEN (default)
  return (
    <div
      style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', backgroundColor: '#000' }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Background Image */}
      {bg?.url && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url(${bg.url})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
      )}

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: bg?.url
          ? 'radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.75) 100%)'
          : 'linear-gradient(180deg, hsl(222,47%,5%) 0%, hsl(222,47%,3%) 100%)',
      }} />

      {/* Subtle inner shadow */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, boxShadow: 'inset 0 0 150px rgba(0,0,0,0.5)', pointerEvents: 'none' }} />

      {/* Main Content */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 3,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '6vw',
      }}>
        <AnimatePresence mode="wait">
          {verse ? (
            <motion.div
              key={verse.reference + verse.translation}
              initial={{ opacity: 0, scale: 0.97, filter: 'blur(16px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              style={{ textAlign: 'center', maxWidth: '88vw' }}
            >
              {/* Top ornament */}
              <motion.div
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                transition={{ delay: 0.2, duration: 0.8 }}
                style={{ width: 80, height: 2, background: 'linear-gradient(90deg,transparent,#f5c842,transparent)', margin: '0 auto 3vw' }}
              />

              {/* Verse Text */}
              <p style={{
                fontFamily: '"Cormorant Garamond", Georgia, serif',
                fontSize: getVerseFont(verse.text),
                fontWeight: 400, lineHeight: 1.55,
                color: '#ffffff',
                textShadow: '0 4px 40px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.8)',
                marginBottom: '2.5vw',
                letterSpacing: '0.01em',
              }}>
                "{verse.text}"
              </p>

              {/* Reference */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.7 }}
              >
                <div style={{
                  fontFamily: '"Outfit", "Inter", sans-serif',
                  fontSize: getReferenceFont(),
                  fontWeight: 800, color: '#f5c842',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  textShadow: '0 2px 16px rgba(0,0,0,0.8)',
                }}>
                  {verse.reference}
                </div>
                <div style={{
                  fontFamily: '"Outfit", "Inter", sans-serif',
                  fontSize: `calc(0.85rem * ${fontSize})`,
                  fontWeight: 500, color: 'rgba(245,200,66,0.55)',
                  letterSpacing: '0.2em', textTransform: 'uppercase',
                  marginTop: '0.4vw',
                }}>
                  {verse.translation}
                </div>
              </motion.div>

              {/* Bottom ornament */}
              <motion.div
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                transition={{ delay: 0.8, duration: 0.8 }}
                style={{ width: 80, height: 2, background: 'linear-gradient(90deg,transparent,#f5c842,transparent)', margin: '3vw auto 0' }}
              />
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: '"Outfit",sans-serif',
                  fontSize: '1.1rem', color: 'rgba(255,255,255,0.06)',
                  letterSpacing: '0.4em', textTransform: 'uppercase',
                }}>
                  SanctiFlow
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hover Controls (for presentation operator) */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', top: 16, right: 16, zIndex: 10,
              display: 'flex', gap: 8,
            }}
          >
            <button
              onClick={() => document.documentElement.requestFullscreen?.()}
              style={{
                padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
                color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600,
              }}
            >⛶ Fullscreen</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
