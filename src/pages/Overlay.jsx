import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { syncService } from '../services/syncService';
import { BACKGROUNDS } from '../utils/constants';

// OBS Overlay — fully transparent background, lower-third scripture bar
// Usage in OBS: Browser Source → http://localhost:5173/overlay → check "Transparent background"
export default function Overlay() {
  const [verse, setVerse] = useState(null);
  const [background, setBackground] = useState('dark');
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    syncService.init();

    const unsubSyncState = syncService.on('SYNC_STATE', (state) => {
      if (state.activeVerse) setVerse(state.activeVerse);
      else setVerse(null);
      if (state.background) setBackground(state.background);
    });
    const unsubVerse = syncService.on('DISPLAY_VERSE', (data) => {
      setVerse(null);
      setTimeout(() => setVerse(data), 60);
    });
    const unsubClear = syncService.on('CLEAR_SCREEN', () => setVerse(null));
    const unsubBg = syncService.on('CHANGE_BACKGROUND', (data) => setBackground(data.background));
    const unsubPing = syncService.on('PING', () => {
      syncService.broadcast('PONG', { screen: 'overlay' });
    });

    return () => {
      unsubSyncState();
      unsubVerse();
      unsubClear();
      unsubBg();
      unsubPing();
      // Do NOT call syncService.destroy() here — React StrictMode
      // double-mounts effects and destroy() kills the socket permanently
    };
  }, []);

  const bg = BACKGROUNDS.find(b => b.id === background);

  // Theme-aware accent colors for borders, glows, and reference text
  const getThemeAccent = () => {
    if (background === 'golden') return { r: 255, g: 200, b: 50, hex: '#ffc832' };
    if (background === 'nebula') return { r: 160, g: 100, b: 255, hex: '#a064ff' };
    if (background === 'rays')   return { r: 100, g: 200, b: 255, hex: '#64c8ff' };
    return { r: 245, g: 200, b: 66, hex: '#f5c842' };
  };
  const accent = getThemeAccent();

  return (
    // Transparent root — OBS will composite over the video feed
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'transparent',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4vw',
    }}>
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
              borderRadius: '24px',
              padding: '42px 52px',
              maxWidth: '82vw',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              border: `1px solid rgba(${accent.r},${accent.g},${accent.b},0.45)`,
              boxShadow: [
                `0 24px 80px rgba(0,0,0,0.9)`,
                `0 0 60px rgba(${accent.r},${accent.g},${accent.b},0.2)`,
                `0 0 120px rgba(${accent.r},${accent.g},${accent.b},0.08)`,
                `inset 0 1px 0 rgba(255,255,255,0.08)`,
              ].join(', '),
            }}
          >
            {/* Layer 1: Full vivid background image */}
            {bg?.url ? (
              <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url(${bg.url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                zIndex: 0,
              }} />
            ) : (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(135deg, hsl(222,47%,6%) 0%, hsl(222,50%,3%) 100%)',
                zIndex: 0,
              }} />
            )}

            {/* Layer 2: Soft radial vignette — darkens edges, keeps center vivid */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse 85% 80% at 50% 50%, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.7) 100%)',
              zIndex: 0,
            }} />

            {/* Layer 3: Top shimmer accent line */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: '10%',
              right: '10%',
              height: 1,
              background: `linear-gradient(90deg, transparent, rgba(${accent.r},${accent.g},${accent.b},0.5), transparent)`,
              zIndex: 2,
            }} />

            {/* Verse text */}
            <p style={{
              fontFamily: '"Outfit", "Inter", sans-serif',
              fontSize: 'clamp(1.6rem, 3.2vw, 3rem)',
              fontWeight: 800,
              lineHeight: 1.45,
              color: '#ffffff',
              textAlign: 'center',
              textShadow: '0 4px 24px rgba(0,0,0,0.95), 0 2px 12px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)',
              margin: '0 0 22px 0',
              position: 'relative',
              zIndex: 1,
            }}>
              "{verse.text}"
            </p>

            {/* Thin separator */}
            <div style={{
              width: 60,
              height: 2,
              borderRadius: 1,
              background: `linear-gradient(90deg, transparent, ${accent.hex}, transparent)`,
              marginBottom: 16,
              position: 'relative',
              zIndex: 1,
            }} />

            {/* Reference bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', position: 'relative', zIndex: 1 }}>
              <div style={{
                fontFamily: '"Outfit", "Inter", sans-serif',
                fontSize: 'clamp(0.95rem, 1.4vw, 1.3rem)',
                fontWeight: 900,
                color: accent.hex,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                textShadow: `0 2px 12px rgba(${accent.r},${accent.g},${accent.b},0.5)`,
              }}>
                {verse.reference}
              </div>
              <div style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: `rgba(${accent.r},${accent.g},${accent.b},0.5)`,
                boxShadow: `0 0 8px rgba(${accent.r},${accent.g},${accent.b},0.4)`,
              }} />
              <div style={{
                fontFamily: '"Outfit", "Inter", sans-serif',
                fontSize: 'clamp(0.85rem, 1.1vw, 1.1rem)',
                fontWeight: 600,
                color: `rgba(${accent.r},${accent.g},${accent.b},0.65)`,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
              }}>
                {verse.translation}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
