import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/appStore';
import { isGeminiReady } from '../services/geminiService';
import { TRANSLATIONS } from '../utils/constants';

export default function Settings() {
  const navigate = useNavigate();
  const geminiReady = useAppStore(s => s.geminiReady);
  const activeTranslation = useAppStore(s => s.activeTranslation);
  const setActiveTranslation = useAppStore(s => s.setActiveTranslation);
  const autoMode = useAppStore(s => s.autoMode);
  const setAutoMode = useAppStore(s => s.setAutoMode);
  const churchName = useAppStore(s => s.churchName);
  const setChurchName = useAppStore(s => s.setChurchName);
  const addToast = useAppStore(s => s.addToast);

  const [tempChurch, setTempChurch] = useState(churchName);

  const isConnected = geminiReady || isGeminiReady();

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    color: 'white', outline: 'none', boxSizing: 'border-box',
    transition: 'border 0.2s ease',
  };

  const cardStyle = {
    background: 'hsla(222,40%,10%,0.8)', border: '1px solid hsla(255,255,255,0.06)',
    borderRadius: 16, padding: '20px 22px', marginBottom: 14, backdropFilter: 'blur(20px)',
  };

  const labelStyle = {
    fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'block',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'hsl(222,47%,5%)', fontFamily: '"Outfit","Inter",sans-serif' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px',
        background: 'hsla(222,40%,8%,0.9)', borderBottom: '1px solid hsla(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
      }}>
        <button onClick={() => navigate('/')} style={{
          padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600,
        }}>← Back</button>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: 0 }}>⚙ Settings</h1>
      </div>

      <div style={{ maxWidth: 640, margin: '32px auto', padding: '0 20px' }}>

        {/* Connection Status */}
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'white' }}>Gemini AI Engine</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
              Model: gemini-2.0-flash · {isConnected ? 'Connected and ready' : 'Not connected'}
            </div>
          </div>
          <div style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
            background: isConnected ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: isConnected ? '#22c55e' : '#ef4444',
          }}>
            {isConnected ? '● ONLINE' : '● OFFLINE'}
          </div>
        </div>

        {/* API Security Info */}
        <div style={cardStyle}>
          <label style={labelStyle}>AI Engine Security</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <span style={{ fontSize: 20 }}>🛡️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>Secure Server Configuration</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                Your Gemini API credentials are secured in the backend environment (.env). They are never exposed to the frontend or browser network requests.
              </div>
            </div>
          </div>
        </div>

        {/* Church Name */}
        <div style={cardStyle}>
          <label style={labelStyle}>Church Name</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" style={{ ...inputStyle, flex: 1 }} value={tempChurch}
              onChange={e => setTempChurch(e.target.value)} placeholder="Your Church Name" />
            <button onClick={() => { setChurchName(tempChurch); addToast({ type: 'success', message: 'Church name updated' }); }}
              style={{ padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', flexShrink: 0 }}>
              Save
            </button>
          </div>
        </div>

        {/* Default Translation */}
        <div style={cardStyle}>
          <label style={labelStyle}>Default Bible Translation</label>
          <select value={activeTranslation} onChange={e => setActiveTranslation(e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}>
            {TRANSLATIONS.map(t => <option key={t.id} value={t.id} style={{ background: '#0f1729' }}>{t.shortName} — {t.name}</option>)}
          </select>
        </div>

        {/* AI Mode */}
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'white', marginBottom: 3 }}>Auto-Project Mode</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
              When ON: scriptures ≥85% confidence project automatically.<br />
              When OFF: all detections go to approval queue.
            </div>
          </div>
          <div onClick={() => setAutoMode(!autoMode)} style={{
            width: 48, height: 26, borderRadius: 13, cursor: 'pointer', flexShrink: 0, position: 'relative',
            background: autoMode ? '#f5c842' : 'rgba(255,255,255,0.1)', transition: 'all 0.2s ease',
          }}>
            <div style={{
              position: 'absolute', top: 3, borderRadius: '50%', width: 20, height: 20,
              background: 'white', transition: 'left 0.2s ease',
              left: autoMode ? 25 : 3, boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }} />
          </div>
        </div>

        {/* Quota Tips */}
        <div style={cardStyle}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#f5c842', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>API Quota Tips</div>
          {[
            { n: 1, text: 'The AI analyzes speech every 4.5s — well within Google\'s 15 RPM free limit.' },
            { n: 2, text: 'If quota exceeded: create a new key at aistudio.google.com (each account gets 1,500 free requests/day).' },
            { n: 3, text: 'For a 2-hour live service: enable billing on Google Cloud — cost ~$0.15 per sermon with Gemini 2.5 Pro.' },
            { n: 4, text: 'Without AI: you can still manually search and project any verse using the search bar.' },
          ].map(tip => (
            <div key={tip.n} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
              <span style={{ color: '#f5c842', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{tip.n}.</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{tip.text}</span>
            </div>
          ))}
        </div>

        {/* Voice Commands Reference */}
        <div style={cardStyle}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#f5c842', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Voice Commands</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              ['Next verse', 'Go forward'],
              ['Previous verse', 'Go back'],
              ['Clear screen', 'Blank screen'],
              ['Show that again', 'Repeat verse'],
              ['Switch to NIV', 'Change translation'],
              ['Next chapter', 'Prev chapter'],
            ].map(([cmd, alt], i) => (
              <div key={i} style={{ padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 12, color: 'white', fontWeight: 600 }}>"{cmd}"</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>or "{alt}"</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
