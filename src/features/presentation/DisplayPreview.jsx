import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useAppStore from '../../store/appStore';
import { fetchVerse, parseReference } from '../../services/bibleService';
import { syncService } from '../../services/syncService';
import { BACKGROUNDS, TRANSLATIONS } from '../../utils/constants';

export default function DisplayPreview({ onProject }) {
  const currentVerse      = useAppStore(s => s.currentVerse);
  const clearCurrentVerse = useAppStore(s => s.clearCurrentVerse);
  const activeBackground  = useAppStore(s => s.activeBackground);
  const setActiveBackground = useAppStore(s => s.setActiveBackground);
  const activeTranslation = useAppStore(s => s.activeTranslation);
  const setActiveTranslation = useAppStore(s => s.setActiveTranslation);
  const isLive            = useAppStore(s => s.isLive);
  const setIsLive         = useAppStore(s => s.setIsLive);
  const autoMode          = useAppStore(s => s.autoMode);
  const setAutoMode       = useAppStore(s => s.setAutoMode);
  const fontSize          = useAppStore(s => s.fontSize);
  const setFontSize       = useAppStore(s => s.setFontSize);
  const displayMode       = useAppStore(s => s.displayMode);
  const setDisplayMode    = useAppStore(s => s.setDisplayMode);
  const addToast          = useAppStore(s => s.addToast);

  const [searchQuery, setSearchQuery]   = useState('');
  const [isSearching, setIsSearching]   = useState(false);
  const [isSwitching, setIsSwitching]   = useState(false);

  const bg = BACKGROUNDS.find(b => b.id === activeBackground);

  // ── Live sync: push verse whenever isLive turns on ───────
  useEffect(() => {
    if (isLive && currentVerse) {
      syncService.sendVerse(currentVerse);
    } else if (!isLive) {
      syncService.sendClear();
    }
  }, [isLive]);

  // ── Sync font/mode/bg to display screen ─────────────────
  useEffect(() => { syncService.sendFontSize(fontSize); }, [fontSize]);
  useEffect(() => { syncService.sendDisplayMode(displayMode); }, [displayMode]);
  useEffect(() => { syncService.sendBackground(activeBackground); }, [activeBackground]);

  // ── Search ───────────────────────────────────────────────
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const parsed = parseReference(searchQuery.trim());
      if (parsed) {
        const verse = await fetchVerse(activeTranslation, parsed.book, parsed.chapter, parsed.verseStart, parsed.verseEnd || parsed.verseStart);
        onProject(verse);
        setSearchQuery('');
      } else {
        addToast({ type: 'warning', message: 'Try format: John 3:16 or Psalm 23:1' });
      }
    } catch (err) {
      addToast({ type: 'error', message: `Not found: "${searchQuery}"` });
    }
    setIsSearching(false);
  };

  // ── Translation switch — refetch current verse ───────────
  const handleTranslationChange = async (newT) => {
    if (newT === activeTranslation) return;
    setActiveTranslation(newT);
    syncService.sendTranslation(newT);
    if (currentVerse) {
      setIsSwitching(true);
      try {
        const v = await fetchVerse(newT, currentVerse.book, currentVerse.chapter, currentVerse.verseStart, currentVerse.verseEnd);
        onProject(v);
        addToast({ type: 'success', message: `Translation → ${newT}` });
      } catch {
        addToast({ type: 'error', message: `${newT} not available for this verse` });
      }
      setIsSwitching(false);
    }
  };

  // ── Go Live toggle ────────────────────────────────────────
  const handleGoLive = () => {
    const newLive = !isLive;
    setIsLive(newLive);
    if (newLive && currentVerse) {
      syncService.sendVerse(currentVerse);
      addToast({ type: 'success', message: '🔴 LIVE — Syncing to all screens' });
    } else {
      syncService.sendClear();
      addToast({ type: 'info', message: 'Screens paused' });
    }
  };

  const handleClear = () => {
    clearCurrentVerse();
    syncService.sendClear();
    addToast({ type: 'info', message: 'Screen cleared' });
  };

  const navAction = async (action) => {
    if (window.__sf?.[action]) {
      try { await window.__sf[action](); }
      catch (e) { addToast({ type: 'error', message: `Nav error: ${e.message}` }); }
    }
  };

  const openDisplay  = () => {
    syncService.init(); // Ensure channel is fresh
    const w = window.open('/display', 'SanctiFlow_Display', 'width=1920,height=1080');
    if (!w) addToast({ type: 'warning', message: 'Allow pop-ups for this site' });
  };
  const openOverlay  = () => {
    const w = window.open('/overlay', 'SanctiFlow_Overlay', 'width=1920,height=1080');
    if (!w) addToast({ type: 'warning', message: 'Allow pop-ups for this site' });
  };

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
        padding: '10px 14px', borderBottom: '1px solid hsla(255,255,255,0.06)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'white' }}>🖥 Display</span>
          {isLive && (
            <span style={{ padding: '1px 6px', borderRadius: 20, background: 'rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 9, fontWeight: 800, animation: 'pulse-dot 2s infinite' }}>● LIVE</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={handleClear} style={{
            padding: '4px 9px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 10,
            background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', fontWeight: 600,
          }}>Clear</button>
          <button onClick={handleGoLive} id="go-live-btn" style={{
            padding: '4px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
            fontWeight: 800, fontSize: 11, letterSpacing: '0.05em',
            background: isLive
              ? 'rgba(239,68,68,0.2)'
              : 'linear-gradient(135deg,#f5c842,#e07b39)',
            color: isLive ? '#ef4444' : '#1a1000',
            boxShadow: isLive ? '0 0 12px rgba(239,68,68,0.25)' : '0 0 14px rgba(245,200,66,0.3)',
          }}>
            {isLive ? '⏸ Pause' : '▶ Go Live'}
          </button>
        </div>
      </div>

      {/* Preview window */}
      <div style={{
        flex: 1, margin: '8px 8px 4px', borderRadius: 10, overflow: 'hidden',
        position: 'relative', minHeight: 110,
        backgroundColor: '#000',
        backgroundImage: bg?.url ? `url(${bg.url})` : 'none',
        backgroundSize: 'cover', backgroundPosition: 'center',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* dark overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center,rgba(0,0,0,0.3),rgba(0,0,0,0.85))' }} />

        <AnimatePresence mode="wait">
          {currentVerse ? (
            <motion.div
              key={currentVerse.reference + currentVerse.translation}
              initial={{ opacity: 0, scale: 0.96, filter: 'blur(8px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              style={{ position: 'relative', zIndex: 2, padding: '10px 14px', textAlign: 'center', width: '100%' }}
            >
              <div style={{ width: 28, height: 1.5, background: 'linear-gradient(90deg,transparent,#f5c842,transparent)', margin: '0 auto 7px' }} />
              <p style={{
                fontFamily: '"Cormorant Garamond",Georgia,serif',
                fontSize: isSwitching ? '11px' : '11px',
                lineHeight: 1.5, color: 'white',
                textShadow: '0 2px 12px rgba(0,0,0,0.9)',
                marginBottom: 6,
                display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                opacity: isSwitching ? 0.4 : 1, transition: 'opacity 0.3s ease',
              }}>"{currentVerse.text}"</p>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#f5c842', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {currentVerse.reference} · {currentVerse.translation}
              </div>
              <div style={{ width: 28, height: 1.5, background: 'linear-gradient(90deg,transparent,#f5c842,transparent)', margin: '7px auto 0' }} />
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ position: 'relative', zIndex: 2, textAlign: 'center', color: 'rgba(255,255,255,0.2)' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>📺</div>
              <p style={{ fontSize: 11 }}>No verse selected</p>
              <p style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>Search or speak to project</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* LIVE badge */}
        {isLive && (
          <div style={{
            position: 'absolute', top: 7, right: 7, zIndex: 3,
            padding: '2px 7px', borderRadius: 20, fontSize: 8, fontWeight: 800,
            background: 'rgba(239,68,68,0.9)', color: 'white', letterSpacing: '0.1em',
          }}>LIVE</div>
        )}
      </div>

      {/* Quick search */}
      <div style={{ padding: '0 8px 6px', flexShrink: 0 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 5 }}>
          <input
            type="text" placeholder="Search verse: John 3:16…"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            id="display-search-input"
            style={{
              flex: 1, padding: '7px 11px', borderRadius: 8, fontSize: 12,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'white', outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button type="submit" disabled={isSearching} style={{
            padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'rgba(245,200,66,0.15)', color: '#f5c842', fontSize: 13, flexShrink: 0,
          }}>{isSearching ? '…' : '🔍'}</button>
        </form>
      </div>

      {/* Verse navigation */}
      {currentVerse && (
        <div style={{ display: 'flex', gap: 3, padding: '0 8px 6px', flexShrink: 0 }}>
          {[
            { label: '⏮', action: 'prevChapter', title: 'Prev Chapter' },
            { label: '◀', action: 'prev',        title: 'Prev Verse' },
            { label: '↺', action: 'repeat',      title: 'Repeat Verse' },
            { label: '▶', action: 'next',        title: 'Next Verse' },
            { label: '⏭', action: 'nextChapter', title: 'Next Chapter' },
          ].map(btn => (
            <button key={btn.action} onClick={() => navAction(btn.action)} title={btn.title} style={{
              flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', fontSize: 12,
              fontWeight: 700, transition: 'all 0.15s ease',
            }}>{btn.label}</button>
          ))}
        </div>
      )}

      {/* Translation selector */}
      <div style={{ padding: '0 8px 5px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {TRANSLATIONS.slice(0, 8).map(t => (
            <button
              key={t.id}
              onClick={() => handleTranslationChange(t.id)}
              disabled={isSwitching}
              style={{
                padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
                background: activeTranslation === t.id ? 'rgba(245,200,66,0.15)' : 'rgba(255,255,255,0.05)',
                color: activeTranslation === t.id ? '#f5c842' : 'rgba(255,255,255,0.35)',
                border: activeTranslation === t.id ? '1px solid rgba(245,200,66,0.3)' : '1px solid rgba(255,255,255,0.07)',
                transition: 'all 0.15s ease',
              }}
            >{t.shortName}</button>
          ))}
        </div>
      </div>

      {/* Background + Mode */}
      <div style={{ padding: '0 8px 6px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {/* Display Mode */}
        <div style={{ display: 'flex', gap: 3 }}>
          {[
            { id: 'fullscreen',  label: 'FULL'    },
            { id: 'lower-third', label: 'LOWER 3' },
            { id: 'stage',       label: 'STAGE'   },
          ].map(m => (
            <button key={m.id} onClick={() => { setDisplayMode(m.id); syncService.sendDisplayMode(m.id); }} style={{
              flex: 1, padding: '4px 0', borderRadius: 6, border: `1px solid ${displayMode === m.id ? 'rgba(245,200,66,0.3)' : 'rgba(255,255,255,0.07)'}`,
              background: displayMode === m.id ? 'rgba(245,200,66,0.08)' : 'transparent',
              color: displayMode === m.id ? '#f5c842' : 'rgba(255,255,255,0.25)',
              fontSize: 9, fontWeight: 800, cursor: 'pointer', letterSpacing: '0.05em', transition: 'all 0.15s ease',
            }}>{m.label}</button>
          ))}
        </div>

        {/* Background */}
        <div style={{ display: 'flex', gap: 3 }}>
          {BACKGROUNDS.map(b => (
            <button key={b.id} onClick={() => { setActiveBackground(b.id); syncService.sendBackground(b.id); }} style={{
              flex: 1, padding: '4px 0', borderRadius: 6, border: `1px solid ${activeBackground === b.id ? 'rgba(245,200,66,0.3)' : 'rgba(255,255,255,0.07)'}`,
              background: activeBackground === b.id ? 'rgba(245,200,66,0.08)' : 'transparent',
              color: activeBackground === b.id ? '#f5c842' : 'rgba(255,255,255,0.25)',
              fontSize: 9, fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s ease',
            }}>{b.name.split(' ')[0].toUpperCase()}</button>
          ))}
        </div>

        {/* Font + Screen buttons */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={() => setFontSize(parseFloat((fontSize - 0.1).toFixed(1)))} style={{ padding: '3px 9px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700 }}>A-</button>
          <button onClick={() => setFontSize(1.0)} style={{ padding: '3px 6px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>{Math.round(fontSize * 100)}%</button>
          <button onClick={() => setFontSize(parseFloat((fontSize + 0.1).toFixed(1)))} style={{ padding: '3px 9px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700 }}>A+</button>
          <div style={{ flex: 1 }} />
          <button onClick={openDisplay} id="open-display-btn" style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid rgba(245,200,66,0.2)', cursor: 'pointer', background: 'rgba(245,200,66,0.07)', color: '#f5c842', fontSize: 9, fontWeight: 800 }}>🖥 SCREEN</button>
          <button onClick={openOverlay} id="open-overlay-btn" style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid rgba(139,92,246,0.2)', cursor: 'pointer', background: 'rgba(139,92,246,0.07)', color: '#a78bfa', fontSize: 9, fontWeight: 800 }}>📺 OBS</button>
        </div>

        {/* Auto mode toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
            Auto-Project (≥85%)
          </span>
          <div onClick={() => setAutoMode(!autoMode)} style={{
            width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
            background: autoMode ? '#f5c842' : 'rgba(255,255,255,0.1)',
            position: 'relative', transition: 'all 0.2s ease', flexShrink: 0,
          }}>
            <div style={{
              position: 'absolute', top: 2, borderRadius: '50%', width: 16, height: 16,
              background: 'white', transition: 'left 0.2s ease',
              left: autoMode ? 18 : 2, boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}
