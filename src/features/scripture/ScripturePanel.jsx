import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useAppStore from '../../store/appStore';
import { fetchVerse, parseReference } from '../../services/bibleService';

export default function ScripturePanel({ onProject }) {
  const detectedScriptures = useAppStore(s => s.detectedScriptures);
  const activeTranslation = useAppStore(s => s.activeTranslation);
  const autoMode = useAppStore(s => s.autoMode);
  const addToast = useAppStore(s => s.addToast);
  const clearDetectedScriptures = useAppStore(s => s.clearDetectedScriptures);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [filterTier, setFilterTier] = useState('all'); // 'all' | 'auto' | 'suggest' | 'low'

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const parsed = parseReference(searchQuery.trim());
      if (parsed) {
        const verse = await fetchVerse(activeTranslation, parsed.book, parsed.chapter, parsed.verseStart, parsed.verseEnd || parsed.verseStart);
        onProject(verse);
        addToast({ type: 'success', message: `📖 ${verse.reference}` });
        setSearchQuery('');
      } else {
        addToast({ type: 'warning', message: 'Format: John 3:16 or Psalm 23' });
      }
    } catch {
      addToast({ type: 'error', message: `Not found: "${searchQuery}"` });
    }
    setIsSearching(false);
  };

  const getConfTier = (c) => {
    if (c >= 0.85) return { label: 'AUTO', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)' };
    if (c >= 0.60) return { label: 'REVIEW', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' };
    return { label: 'LOW', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' };
  };

  const filtered = filterTier === 'all' ? detectedScriptures
    : filterTier === 'auto' ? detectedScriptures.filter(s => s.confidence >= 0.85)
    : filterTier === 'suggest' ? detectedScriptures.filter(s => s.confidence >= 0.60 && s.confidence < 0.85)
    : detectedScriptures.filter(s => s.confidence < 0.60);

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'hsla(222,40%,10%,0.8)',
      border: '1px solid hsla(255,255,255,0.06)',
      borderRadius: 14, backdropFilter: 'blur(20px)',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid hsla(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'white' }}>📖 AI Scripture Detections</span>
            {detectedScriptures.length > 0 && (
              <span style={{ padding: '1px 7px', borderRadius: 20, background: 'rgba(245,200,66,0.15)', color: '#f5c842', fontSize: 10, fontWeight: 700 }}>
                {detectedScriptures.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Auto</span>
            <div
              onClick={() => useAppStore.getState().setAutoMode(!autoMode)}
              style={{
                width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
                background: autoMode ? '#f5c842' : 'rgba(255,255,255,0.1)',
                position: 'relative', transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: 2, borderRadius: '50%', width: 16, height: 16,
                background: 'white', transition: 'left 0.2s ease',
                left: autoMode ? 18 : 2,
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </div>
            {detectedScriptures.length > 0 && (
              <button onClick={clearDetectedScriptures} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 11 }}>Clear</button>
            )}
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            placeholder="Search: John 3:16, Psalm 23:1..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            id="scripture-search-input"
            style={{
              flex: 1, padding: '7px 12px', borderRadius: 8, fontSize: 12,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'white', outline: 'none',
            }}
          />
          <button type="submit" disabled={isSearching} style={{
            padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'rgba(245,200,66,0.15)', color: '#f5c842', fontSize: 12, fontWeight: 700,
          }}>
            {isSearching ? '…' : '🔍'}
          </button>
        </form>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '6px 10px', borderBottom: '1px solid hsla(255,255,255,0.06)', flexShrink: 0 }}>
        {[
          { id: 'all', label: `All (${detectedScriptures.length})` },
          { id: 'auto', label: `● Auto (${detectedScriptures.filter(s => s.confidence >= 0.85).length})`, color: '#22c55e' },
          { id: 'suggest', label: `● Review (${detectedScriptures.filter(s => s.confidence >= 0.6 && s.confidence < 0.85).length})`, color: '#f59e0b' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilterTier(f.id)}
            style={{
              padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
              background: filterTier === f.id ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: f.color || (filterTier === f.id ? 'white' : 'rgba(255,255,255,0.35)'),
              transition: 'all 0.15s ease',
            }}
          >{f.label}</button>
        ))}
      </div>

      {/* Scripture List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        <AnimatePresence>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.2)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🎙</div>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.35)' }}>
                {detectedScriptures.length === 0 ? 'Click Listen and start preaching' : 'No matches in this filter'}
              </p>
              {detectedScriptures.length === 0 && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, textAlign: 'left', fontSize: 11, lineHeight: 1.8 }}>
                  <div style={{ color: '#f5c842', fontWeight: 700, marginBottom: 4 }}>AI understands:</div>
                  <div>"For God so loved the world" → John 3:16</div>
                  <div>"The Lord is my shepherd" → Psalm 23:1</div>
                  <div>"Walk by faith not by sight" → 2 Cor 5:7</div>
                </div>
              )}
            </div>
          ) : (
            filtered.map((scripture, idx) => {
              const tier = getConfTier(scripture.confidence);
              const pct = Math.round(scripture.confidence * 100);
              return (
                <motion.div
                  key={scripture._id || `${scripture.book}-${scripture.chapter}-${scripture.verseStart}-${idx}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                  onClick={() => {
                    fetchVerse(activeTranslation, scripture.book, scripture.chapter, scripture.verseStart, scripture.verseEnd)
                      .then(v => onProject(v))
                      .catch(() => addToast({ type: 'error', message: 'Could not load verse' }));
                  }}
                  style={{
                    background: tier.bg,
                    border: `1px solid ${tier.border}`,
                    borderRadius: 10, padding: '8px 12px', marginBottom: 6,
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#f5c842' }}>
                      {scripture.book} {scripture.chapter}:{scripture.verseStart}
                      {scripture.verseEnd && scripture.verseEnd !== scripture.verseStart ? `–${scripture.verseEnd}` : ''}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 800, color: tier.color, background: tier.bg, padding: '1px 6px', borderRadius: 20 }}>
                      {tier.label} {pct}%
                    </span>
                  </div>
                  {scripture.matchedText && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', marginBottom: 3 }}>
                      "{scripture.matchedText}"
                    </div>
                  )}
                  {scripture.reasoning && (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>💡 {scripture.reasoning}</div>
                  )}
                  {/* Confidence bar */}
                  <div style={{ marginTop: 5, height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: tier.color, borderRadius: 2,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 3, textAlign: 'right' }}>
                    tap to project
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
