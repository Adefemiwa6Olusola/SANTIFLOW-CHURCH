import { motion, AnimatePresence } from 'framer-motion';
import useAppStore from '../../store/appStore';

const ICONS = {
  next_verse: '⏭', prev_verse: '⏮', clear_screen: '🚫',
  switch_translation: '🌐', repeat_verse: '↺', auto_projected: '🎯',
  next_chapter: '⏭', prev_chapter: '⏮', scripture_detected: '✨',
};

export default function CommandLog() {
  const commandLog = useAppStore(s => s.commandLog);
  const geminiReady = useAppStore(s => s.geminiReady);
  const clearCommandLog = useAppStore(s => s.clearCommandLog);

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'hsla(222,40%,10%,0.8)', border: '1px solid hsla(255,255,255,0.06)',
      borderRadius: 14, backdropFilter: 'blur(20px)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid hsla(255,255,255,0.06)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'white' }}>⚡ AI Activity</span>
          <span style={{
            padding: '1px 7px', borderRadius: 20, fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
            background: geminiReady ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: geminiReady ? '#22c55e' : '#ef4444',
          }}>
            {geminiReady ? '● AI ONLINE' : '● AI OFFLINE'}
          </span>
        </div>
        {commandLog.length > 0 && (
          <button onClick={clearCommandLog} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: 11 }}>Clear</button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', fontSize: 11 }}>
        {commandLog.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.2)' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>⚡</div>
            <p style={{ fontSize: 11 }}>AI commands and detections appear here</p>
          </div>
        ) : (
          <AnimatePresence>
            {commandLog.map(entry => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: '7px 14px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}
              >
                <span style={{ flexShrink: 0, fontSize: 13 }}>{ICONS[entry.action] || '📌'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>
                    {entry.message || entry.action?.replace(/_/g, ' ')}
                  </div>
                  {entry.matchedText && (
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', fontSize: 10, marginTop: 1 }}>
                      "{entry.matchedText}"
                    </div>
                  )}
                </div>
                <span style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0, fontSize: 9, paddingTop: 1 }}>
                  {entry.timestamp}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
