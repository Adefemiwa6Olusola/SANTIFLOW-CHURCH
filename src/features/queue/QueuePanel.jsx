import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useAppStore from '../../store/appStore';
import { getQueue, addToQueue, removeFromQueue, updateQueue } from '../../services/dbService';
import { fetchVerse, parseReference } from '../../services/bibleService';

export default function QueuePanel({ onProject }) {
  const queue = useAppStore(s => s.verseQueue);
  const setQueue = useAppStore(s => s.setVerseQueue);
  const activeTranslation = useAppStore(s => s.activeTranslation);
  const addToast = useAppStore(s => s.addToast);
  const [inputVal, setInputVal] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [activeIdx, setActiveIdx] = useState(null);

  useEffect(() => {
    getQueue().then(setQueue).catch(() => {});
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    setIsAdding(true);
    try {
      const parsed = parseReference(inputVal.trim());
      if (!parsed) { addToast({ type: 'error', message: 'Try: John 3:16 or Romans 8:28' }); setIsAdding(false); return; }
      const verseData = await fetchVerse(activeTranslation, parsed.book, parsed.chapter, parsed.verseStart, parsed.verseEnd || parsed.verseStart);
      const entry = await addToQueue(verseData);
      setQueue([...queue, entry]);
      setInputVal('');
      addToast({ type: 'success', message: `Added: ${verseData.reference}` });
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Verse not found' });
    }
    setIsAdding(false);
  };

  const handleProject = (entry, idx) => {
    setActiveIdx(idx);
    onProject(entry);
  };

  const handleRemove = async (id, e) => {
    e.stopPropagation();
    await removeFromQueue(id);
    setQueue(queue.filter(i => i.id !== id));
  };

  const handleClearAll = async () => {
    for (const item of queue) await removeFromQueue(item.id).catch(() => {});
    setQueue([]);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'hsla(222,40%,10%,0.8)', border: '1px solid hsla(255,255,255,0.06)', borderRadius: 14, backdropFilter: 'blur(20px)' }}>

      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid hsla(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'white' }}>📋 Sermon Queue</span>
            <span style={{ padding: '1px 7px', borderRadius: 20, background: 'rgba(167,139,250,0.15)', color: '#a78bfa', fontSize: 10, fontWeight: 700 }}>{queue.length} items</span>
          </div>
          {queue.length > 0 && (
            <button onClick={handleClearAll} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 11 }}>Clear all</button>
          )}
        </div>

        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            placeholder="Add verse: John 3:16..."
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            style={{
              flex: 1, padding: '7px 12px', borderRadius: 8, fontSize: 12,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'white', outline: 'none',
            }}
          />
          <button type="submit" disabled={isAdding} style={{
            padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#f5c842,#e07b39)', color: '#1a1000',
            fontWeight: 800, fontSize: 14,
          }}>
            {isAdding ? '…' : '+'}
          </button>
        </form>
      </div>

      {/* Queue List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        <AnimatePresence>
          {queue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
              <p>Build your sermon queue here</p>
              <p style={{ marginTop: 4, opacity: 0.6 }}>Add verses before the service for instant projection</p>
            </div>
          ) : (
            queue.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16 }}
                onClick={() => handleProject(entry, index)}
                style={{
                  padding: '10px 12px', borderRadius: 10, marginBottom: 6, cursor: 'pointer',
                  background: activeIdx === index ? 'rgba(245,200,66,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${activeIdx === index ? 'rgba(245,200,66,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', minWidth: 18, textAlign: 'center', fontWeight: 700 }}>{index + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: activeIdx === index ? '#f5c842' : 'white' }}>{entry.reference}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{entry.translation}</div>
                </div>
                {activeIdx === index && (
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#22c55e', padding: '1px 6px', background: 'rgba(34,197,94,0.1)', borderRadius: 20 }}>LIVE</span>
                )}
                <button
                  onClick={(e) => handleRemove(entry.id, e)}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 14, padding: '2px 4px', flexShrink: 0 }}
                >✕</button>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
