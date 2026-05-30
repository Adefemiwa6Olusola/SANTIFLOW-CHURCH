import useAppStore from '../../store/appStore';

export default function SessionStats() {
  const totalDetected = useAppStore(s => s.totalScripturesDetected);
  const totalProjected = useAppStore(s => s.totalScripturesProjected);
  const scriptureHistory = useAppStore(s => s.scriptureHistory);
  const commandLog = useAppStore(s => s.commandLog);
  const voiceStatus = useAppStore(s => s.voiceStatus);
  const sessionStartTime = useAppStore(s => s.sessionStartTime);
  const transcriptEntries = useAppStore(s => s.transcriptEntries);
  const detectedScriptures = useAppStore(s => s.detectedScriptures);
  const sermonTopic = useAppStore(s => s.sermonTopic);

  const wordCount = transcriptEntries.reduce((acc, e) => acc + (e.text?.split(' ').length || 0), 0);

  const sessionDuration = sessionStartTime
    ? Math.floor((Date.now() - sessionStartTime) / 1000 / 60)
    : 0;

  // Most detected book
  const bookCounts = {};
  detectedScriptures.forEach(s => { bookCounts[s.book] = (bookCounts[s.book] || 0) + 1; });
  const topBook = Object.entries(bookCounts).sort((a, b) => b[1] - a[1])[0];

  // Commands breakdown
  const cmdCounts = {};
  commandLog.forEach(c => { cmdCounts[c.action] = (cmdCounts[c.action] || 0) + 1; });

  const stats = [
    { label: 'Scriptures Detected', value: totalDetected, icon: '🎯', color: '#f5c842' },
    { label: 'Scriptures Projected', value: totalProjected, icon: '📺', color: '#22c55e' },
    { label: 'Words Transcribed', value: wordCount.toLocaleString(), icon: '🎙', color: '#60a5fa' },
    { label: 'Session Duration', value: `${sessionDuration}m`, icon: '⏱', color: '#a78bfa' },
    { label: 'Commands Executed', value: commandLog.length, icon: '⚡', color: '#fb923c' },
    { label: 'In History', value: scriptureHistory.length, icon: '🕘', color: '#34d399' },
  ];

  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {stats.map(stat => (
          <div key={stat.label} style={{
            padding: '16px 14px',
            background: 'hsla(222,40%,10%,0.8)',
            border: '1px solid hsla(255,255,255,0.06)',
            borderRadius: 14, backdropFilter: 'blur(20px)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{stat.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: stat.color, marginBottom: 2 }}>{stat.value}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Sermon Context */}
      {(sermonTopic || topBook) && (
        <div style={{
          padding: '14px 16px',
          background: 'hsla(222,40%,10%,0.8)',
          border: '1px solid hsla(255,255,255,0.06)',
          borderRadius: 14,
        }}>
          <div style={{ fontSize: 11, color: '#f5c842', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Sermon Intelligence</div>
          <div style={{ display: 'flex', gap: 24 }}>
            {sermonTopic && (
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>Detected Topic</div>
                <div style={{ fontSize: 14, color: 'white', fontWeight: 600 }}>{sermonTopic}</div>
              </div>
            )}
            {topBook && (
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>Top Book</div>
                <div style={{ fontSize: 14, color: '#f5c842', fontWeight: 600 }}>{topBook[0]} <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>({topBook[1]}x)</span></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detected Books Breakdown */}
      {Object.keys(bookCounts).length > 0 && (
        <div style={{
          padding: '14px 16px',
          background: 'hsla(222,40%,10%,0.8)',
          border: '1px solid hsla(255,255,255,0.06)',
          borderRadius: 14,
        }}>
          <div style={{ fontSize: 11, color: '#f5c842', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Books Referenced</div>
          {Object.entries(bookCounts).sort((a, b) => b[1] - a[1]).map(([book, count]) => (
            <div key={book} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', width: 120, flexShrink: 0 }}>{book}</span>
              <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${(count / Math.max(...Object.values(bookCounts))) * 100}%`,
                  background: 'linear-gradient(90deg,#f5c842,#e07b39)',
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <span style={{ fontSize: 11, color: '#f5c842', fontWeight: 700, width: 20, textAlign: 'right' }}>{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Live Status */}
      <div style={{
        padding: '12px 16px',
        background: 'hsla(222,40%,10%,0.8)',
        border: '1px solid hsla(255,255,255,0.06)',
        borderRadius: 14,
        display: 'flex', gap: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: voiceStatus === 'listening' ? '#22c55e' : '#475569',
            boxShadow: voiceStatus === 'listening' ? '0 0 8px #22c55e' : 'none',
            animation: voiceStatus === 'listening' ? 'pulse-glow 2s infinite' : 'none',
          }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
            {voiceStatus === 'listening' ? 'Microphone Active' : voiceStatus === 'paused' ? 'Paused' : 'Microphone Off'}
          </span>
        </div>
      </div>
    </div>
  );
}
