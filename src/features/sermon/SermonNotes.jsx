import { motion, AnimatePresence } from 'framer-motion';
import useAppStore from '../../store/appStore';

export default function SermonNotes({ onGenerateMore, isGenerating }) {
  const sermonNotes = useAppStore(s => s.sermonNotes);
  const sermonTopic = useAppStore(s => s.sermonTopic);
  const keyPhrases = useAppStore(s => s.keyPhrases);
  const clearSermonNotes = useAppStore(s => s.clearSermonNotes);
  const transcriptEntries = useAppStore(s => s.transcriptEntries);

  const wordCount = transcriptEntries.reduce((acc, e) => acc + (e.text?.split(' ').length || 0), 0);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 10 }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', flexShrink: 0,
        background: 'hsla(222,40%,10%,0.8)',
        border: '1px solid hsla(255,255,255,0.06)',
        borderRadius: 14, backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'white', marginBottom: 2 }}>📝 Sermon Notes</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            {wordCount} words transcribed · {transcriptEntries.length} entries
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {sermonNotes.length > 0 && (
            <button onClick={clearSermonNotes} style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 11, cursor: 'pointer',
            }}>Clear All</button>
          )}
          <button onClick={onGenerateMore} disabled={isGenerating} style={{
            padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12,
            background: isGenerating ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#f5c842,#e07b39)',
            color: isGenerating ? 'rgba(255,255,255,0.4)' : '#1a1000',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {isGenerating
              ? <><span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#f5c842', borderRadius: '50%', display: 'inline-block', animation: 'rotate-slow 0.8s linear infinite' }} /> Generating…</>
              : '✨ Generate Notes'
            }
          </button>
        </div>
      </div>

      {/* Live Context (detected topics + phrases) */}
      {(sermonTopic || keyPhrases.length > 0) && (
        <div style={{
          padding: '12px 16px',
          background: 'hsla(222,40%,10%,0.8)',
          border: '1px solid hsla(255,255,255,0.06)',
          borderRadius: 14, flexShrink: 0,
        }}>
          {sermonTopic && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Detected Topic</span>
              <div style={{ fontSize: 13, color: '#f5c842', fontWeight: 600, marginTop: 2 }}>{sermonTopic}</div>
            </div>
          )}
          {keyPhrases.length > 0 && (
            <div>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Key Phrases</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {keyPhrases.slice(0, 8).map((phrase, i) => (
                  <span key={i} style={{
                    padding: '2px 8px', borderRadius: 20, fontSize: 11,
                    background: 'rgba(245,200,66,0.1)', color: '#f5c842',
                    border: '1px solid rgba(245,200,66,0.2)',
                  }}>{phrase}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notes List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <AnimatePresence>
          {sermonNotes.length === 0 ? (
            <div style={{
              padding: 32, textAlign: 'center',
              background: 'hsla(222,40%,10%,0.8)',
              border: '1px solid hsla(255,255,255,0.06)',
              borderRadius: 14, color: 'rgba(255,255,255,0.2)',
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>No sermon notes yet</p>
              <p style={{ fontSize: 12, lineHeight: 1.6 }}>
                Start listening to the sermon, then click<br /><strong style={{ color: 'rgba(255,255,255,0.5)' }}>✨ Generate Notes</strong> to create AI-powered notes from the transcript.
              </p>
            </div>
          ) : (
            sermonNotes.map((note, idx) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginBottom: 12,
                  background: 'hsla(222,40%,10%,0.8)',
                  border: '1px solid hsla(255,255,255,0.06)',
                  borderRadius: 14, padding: 18,
                }}
              >
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 10 }}>
                  Generated {new Date(note.generatedAt).toLocaleTimeString()}
                </div>

                {note.summary && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: '#f5c842', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>SUMMARY</div>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.7 }}>{note.summary}</p>
                  </div>
                )}

                {note.keyPoints?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: '#f5c842', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>KEY POINTS</div>
                    {note.keyPoints.map((point, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                        <span style={{ color: '#f5c842', flexShrink: 0, fontSize: 11 }}>▸</span>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{point}</span>
                      </div>
                    ))}
                  </div>
                )}

                {note.suggestedScriptures?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: '#f5c842', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>SUGGESTED SCRIPTURES</div>
                    {note.suggestedScriptures.map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#f5c842', flexShrink: 0 }}>{s.reference}</span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>— {s.reason}</span>
                      </div>
                    ))}
                  </div>
                )}

                {note.actionPoints?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: '#f5c842', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>ACTION POINTS</div>
                    {note.actionPoints.map((point, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                        <span style={{ color: '#22c55e', flexShrink: 0, fontSize: 11 }}>✓</span>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{point}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
