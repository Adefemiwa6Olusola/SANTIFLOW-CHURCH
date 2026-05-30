import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useAppStore from '../../store/appStore';
import { getHistory } from '../../services/dbService';

export default function HistoryPanel({ onProject }) {
  const history = useAppStore(s => s.scriptureHistory);
  const setHistory = useAppStore(s => s.setScriptureHistory);
  const addToast = useAppStore(s => s.addToast);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    getHistory().then(setHistory).catch(() => {});
  }, []);

  const filtered = searchQuery
    ? history.filter(e => e.reference?.toLowerCase().includes(searchQuery.toLowerCase()) || e.book?.toLowerCase().includes(searchQuery.toLowerCase()))
    : history;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'hsla(222,40%,10%,0.8)', border: '1px solid hsla(255,255,255,0.06)', borderRadius: 14, backdropFilter: 'blur(20px)' }}>

      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid hsla(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'white' }}>🕘 Projected History</span>
            <span style={{ padding: '1px 7px', borderRadius: 20, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', fontSize: 10, fontWeight: 700 }}>{history.length}</span>
          </div>
        </div>
        <input
          type="text"
          placeholder="Search history..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%', padding: '7px 12px', borderRadius: 8, fontSize: 12,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'white', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🕘</div>
            <p>{history.length === 0 ? 'No verses projected yet' : 'No results found'}</p>
          </div>
        ) : (
          filtered.map((entry, idx) => (
            <div
              key={entry.id || idx}
              onClick={() => { onProject(entry); addToast({ type: 'success', message: `Re-projected: ${entry.reference}` }); }}
              style={{
                padding: '9px 12px', borderRadius: 10, marginBottom: 5, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#f5c842' }}>{entry.reference}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                  {entry.translation} · {entry.type || 'manual'}
                </div>
              </div>
              <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.15)' }}>↺</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
