import { motion, AnimatePresence } from 'framer-motion';
import useAppStore from '../../store/appStore';
import { fetchVerse } from '../../services/bibleService';

export default function ApprovalQueue({ onProject }) {
  const approvalQueue = useAppStore(s => s.approvalQueue);
  const removeFromApprovalQueue = useAppStore(s => s.removeFromApprovalQueue);
  const activeTranslation = useAppStore(s => s.activeTranslation);
  const addToast = useAppStore(s => s.addToast);

  const handleApprove = async (scripture) => {
    try {
      const verse = await fetchVerse(activeTranslation, scripture.book, scripture.chapter, scripture.verseStart, scripture.verseEnd);
      onProject(verse);
      removeFromApprovalQueue(scripture._id);
      addToast({ type: 'success', message: `✅ Approved: ${verse.reference}` });
    } catch {
      addToast({ type: 'error', message: 'Could not load verse' });
    }
  };

  const handleDismiss = (id) => {
    removeFromApprovalQueue(id);
  };

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'hsla(222,40%,10%,0.8)',
      border: '1px solid hsla(255,200,50,0.12)',
      borderRadius: 14, backdropFilter: 'blur(20px)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid hsla(255,200,50,0.1)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'white' }}>⏳ Approval Queue</span>
          {approvalQueue.length > 0 && (
            <span style={{ padding: '1px 7px', borderRadius: 20, background: 'rgba(245,158,11,0.2)', color: '#f59e0b', fontSize: 10, fontWeight: 700 }}>
              {approvalQueue.length}
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>60–84% confidence</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        <AnimatePresence>
          {approvalQueue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>⏳</div>
              <p>Medium-confidence matches appear here for your approval</p>
            </div>
          ) : (
            approvalQueue.map((scripture, idx) => (
              <motion.div
                key={scripture._id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
                style={{
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  borderRadius: 10, padding: '8px 12px', marginBottom: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#f5c842' }}>
                      {scripture.book} {scripture.chapter}:{scripture.verseStart}
                      {scripture.verseEnd && scripture.verseEnd !== scripture.verseStart ? `–${scripture.verseEnd}` : ''}
                    </div>
                    {scripture.matchedText && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginTop: 1 }}>
                        "{scripture.matchedText}"
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>
                      Confidence: {Math.round(scripture.confidence * 100)}%
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button
                    onClick={() => handleApprove(scripture)}
                    style={{
                      flex: 1, padding: '5px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                      background: 'rgba(34,197,94,0.2)', color: '#22c55e', fontSize: 11, fontWeight: 700,
                    }}
                  >✓ Approve & Project</button>
                  <button
                    onClick={() => handleDismiss(scripture._id)}
                    style={{
                      padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                      background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', fontSize: 11,
                    }}
                  >✕</button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
