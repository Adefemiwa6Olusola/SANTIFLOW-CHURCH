import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useAppStore from '../store/appStore';
import useAuthStore from '../store/authStore';
import { useNavigate } from 'react-router-dom';

// Services
import { detectScriptures, isGeminiReady, initGemini, generateSermonNotes } from '../services/geminiService';
import { syncService } from '../services/syncService';
import { fetchVerse, preloadAdjacent } from '../services/bibleService';
import { verseNavigator } from '../services/verseNavigator';
import { addToHistory, getHistory, getQueue } from '../services/dbService';
import speechService from '../services/speechService';

// Feature panels
import VoicePanel from '../features/voice/VoicePanel';
import ScripturePanel from '../features/scripture/ScripturePanel';
import DisplayPreview from '../features/presentation/DisplayPreview';
import ApprovalQueue from '../features/presentation/ApprovalQueue';
import HistoryPanel from '../features/history/HistoryPanel';
import QueuePanel from '../features/queue/QueuePanel';
import SermonNotes from '../features/sermon/SermonNotes';
import SessionStats from '../features/analytics/SessionStats';
import CommandLog from '../features/commands/CommandLog';

const SIDEBAR_TABS = [
  { id: 'main',    icon: '🎙', label: 'Live'    },
  { id: 'queue',   icon: '📋', label: 'Queue'   },
  { id: 'history', icon: '🕘', label: 'History' },
  { id: 'sermon',  icon: '📝', label: 'Notes'   },
  { id: 'stats',   icon: '📊', label: 'Stats'   },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);

  // ── Store ────────────────────────────────────────────────────
  const geminiReady             = useAppStore(s => s.geminiReady);
  const setGeminiReady          = useAppStore(s => s.setGeminiReady);
  const aiStatus                = useAppStore(s => s.aiStatus);
  const setAiStatus             = useAppStore(s => s.setAiStatus);
  const transcriptBuffer        = useAppStore(s => s.transcriptBuffer);
  const clearBuffer             = useAppStore(s => s.clearBuffer);
  const transcriptEntries       = useAppStore(s => s.transcriptEntries);
  const addDetectedScripture    = useAppStore(s => s.addDetectedScripture);
  const addToApprovalQueue      = useAppStore(s => s.addToApprovalQueue);
  const addCommandLog           = useAppStore(s => s.addCommandLog);
  const addToast                = useAppStore(s => s.addToast);
  const activeTranslation       = useAppStore(s => s.activeTranslation);
  const setActiveTranslation    = useAppStore(s => s.setActiveTranslation);
  const autoMode                = useAppStore(s => s.autoMode);
  const isLive                  = useAppStore(s => s.isLive);
  const currentVerse            = useAppStore(s => s.currentVerse);
  const setCurrentVerse         = useAppStore(s => s.setCurrentVerse);
  const clearCurrentVerse       = useAppStore(s => s.clearCurrentVerse);
  const setSermonTopic          = useAppStore(s => s.setSermonTopic);
  const setKeyPhrases           = useAppStore(s => s.setKeyPhrases);
  const addSermonNote           = useAppStore(s => s.addSermonNote);
  const setScriptureHistory     = useAppStore(s => s.setScriptureHistory);
  const setVerseQueue           = useAppStore(s => s.setVerseQueue);
  const incrementDetected       = useAppStore(s => s.incrementDetected);
  const incrementProjected      = useAppStore(s => s.incrementProjected);
  const churchName              = useAppStore(s => s.churchName);
  const activeTab               = useAppStore(s => s.activeTab);
  const setActiveTab            = useAppStore(s => s.setActiveTab);
  const displayMode             = useAppStore(s => s.displayMode);
  const setDisplayMode          = useAppStore(s => s.setDisplayMode);
  const socketConnected         = useAppStore(s => s.socketConnected);

  // ── Local state ──────────────────────────────────────────────
  const processingRef     = useRef(false);
  const bufferRef         = useRef('');
  const quotaWarningLoggedRef = useRef(false);
  const [quotaWarning, setQuotaWarning]     = useState(false);
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [connectedScreens, setConnectedScreens] = useState(0);

  // ── Init on mount ────────────────────────────────────────────
  useEffect(() => {
    // Initialize Gemini (backend handles keys securely)
    const ready = initGemini();
    setGeminiReady(ready);

    // Initialize sync
    syncService.init();

    // Listen for PONG from display screens to count connections
    const unsubPong = syncService.on('PONG', () => {
      setConnectedScreens(c => c + 1);
    });
    // Ping every 5s to detect connected screens
    const pingInterval = setInterval(() => {
      setConnectedScreens(0);
      syncService.sendPing();
    }, 5000);
    syncService.sendPing(); // Initial ping

    // Load persisted data
    getHistory().then(setScriptureHistory).catch(() => {});
    getQueue().then(setVerseQueue).catch(() => {});

    return () => {
      unsubPong();
      clearInterval(pingInterval);
    };
  }, []);



  // Keep bufferRef in sync (avoids stale closure in interval)
  useEffect(() => {
    bufferRef.current = transcriptBuffer;
  }, [transcriptBuffer]);

  // ── Core: Project a verse ─────────────────────────────────────
  const projectVerse = useCallback(async (verseData) => {
    setCurrentVerse(verseData);
    verseNavigator.setPosition(verseData);

    // Push to all connected screens
    if (isLive) {
      syncService.sendVerse(verseData);
    }

    incrementProjected();

    // Save to history
    try {
      const entry = await addToHistory(verseData, verseData.detectedBy === 'ai' ? 'AI' : 'MANUAL');
      useAppStore.getState().addToHistory?.(entry);
      setScriptureHistory(await getHistory());
    } catch {}

    // Preload adjacent verses for fast navigation
    preloadAdjacent(verseData.translation, verseData.book, verseData.chapter).catch(() => {});

    addToast({ type: 'success', message: `📖 ${verseData.reference} (${verseData.translation})` });
  }, [isLive, incrementProjected]);

  // Ref to track last checked interim text to prevent duplicate requests
  const lastCheckedInterimRef = useRef('');

  // ── AI processing loop ────────────────────────────────────────
  useEffect(() => {
    const process = async () => {
      const text = bufferRef.current?.trim();
      if (processingRef.current || !isGeminiReady() || !text) return;

      const cleanText = text.trim();
      const hasReferencePattern = /\d+/.test(cleanText) || /(genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalm|proverbs|ecclesiastes|song|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation)/i.test(cleanText);

      // Require at least 4 characters, and if under 12 characters, it must look like a scripture reference
      if (cleanText.length < 4 || (cleanText.length < 12 && !hasReferencePattern)) return;

      processingRef.current = true;
      setAiStatus('processing');
      clearBuffer();
      bufferRef.current = '';

      try {
        const { references, commands, sermonTopics, keyPhrases, error } = await detectScriptures(cleanText);

        if (error === 'QUOTA_EXCEEDED') {
          if (!quotaWarningLoggedRef.current) {
            setQuotaWarning(true);
            setAiStatus('error');
            addCommandLog({ action: 'quota_warning', message: '⚠ API quota exceeded — will retry automatically' });
            quotaWarningLoggedRef.current = true;
            setTimeout(() => {
              setQuotaWarning(false);
              setAiStatus('idle');
            }, 15000);
          }
        } else if (error === 'SESSION_EXPIRED') {
          if (!quotaWarningLoggedRef.current) {
            addToast({ type: 'warning', message: '🔒 Session expired — please log out and log back in' });
            quotaWarningLoggedRef.current = true;
          }
          setAiStatus('idle');
        } else if (error === 'INVALID_KEY') {
          if (!quotaWarningLoggedRef.current) {
            addToast({ type: 'error', message: '❌ Gemini API key invalid — check server/.env' });
            quotaWarningLoggedRef.current = true;
          }
          setAiStatus('error');
        } else {
          if (quotaWarning) setQuotaWarning(false);
          quotaWarningLoggedRef.current = false;
          setAiStatus('idle');
        }

        if (sermonTopics?.length > 0) setSermonTopic(sermonTopics[0]);
        if (keyPhrases?.length > 0) setKeyPhrases(keyPhrases);

        // Process detected scripture references
        for (const ref of (references || [])) {
          const uniqueId = `${ref.book}-${ref.chapter}-${ref.verseStart}-${Date.now()}`;
          addDetectedScripture({ ...ref, _id: uniqueId });
          incrementDetected();

          if (ref.confidence >= 0.70 && autoMode) {
            // HIGH/MEDIUM-HIGH confidence → auto-project
            try {
              const verseData = await fetchVerse(activeTranslation, ref.book, ref.chapter, ref.verseStart, ref.verseEnd);
              await projectVerse({ ...verseData, detectedBy: 'ai', confidence: ref.confidence });
              addCommandLog({
                action: 'auto_projected',
                message: `Auto-projected: ${verseData.reference}`,
                matchedText: ref.matchedText,
              });
            } catch (e) {
              addCommandLog({ action: 'fetch_error', message: `Could not load ${ref.book} ${ref.chapter}:${ref.verseStart}` });
            }
            break; // Only auto-project the best match
          } else if (ref.confidence >= 0.50 && ref.confidence < 0.70) {
            // MEDIUM confidence → approval queue
            addToApprovalQueue({ ...ref, _id: `${ref.book}-${ref.chapter}-${ref.verseStart}-${Date.now()}` });
            addCommandLog({
              action: 'scripture_detected',
              message: `Needs approval: ${ref.book} ${ref.chapter}:${ref.verseStart} (${Math.round(ref.confidence * 100)}%)`,
              matchedText: ref.matchedText,
            });
          }
        }

        // Handle voice commands
        for (const cmd of (commands || [])) {
          addCommandLog({ ...cmd, message: cmd.action?.replace(/_/g, ' ') });
          await handleVoiceCommand(cmd);
        }

      } catch (err) {
        console.error('[Dashboard] AI process error:', err);
        setAiStatus('error');
      } finally {
        processingRef.current = false;
        setTimeout(() => setAiStatus(prev => prev === 'error' ? 'error' : 'idle'), 600);
      }
    };

    const text = transcriptBuffer?.trim();
    if (!text) return;

    const hasReferencePattern = /\d+/.test(text) || /(genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalm|proverbs|ecclesiastes|song|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation)/i.test(text);
    const delay = hasReferencePattern ? 300 : 650; // Optimized response latency (down from 400/800)

    const handler = setTimeout(process, delay);
    return () => clearTimeout(handler);
  }, [transcriptBuffer, clearBuffer, autoMode, activeTranslation, isLive, projectVerse]);

  // ── Real-time Interim Transcript Processing ───────────────────
  const interimText = useAppStore(s => s.interimText);
  useEffect(() => {
    const text = interimText?.trim();
    if (!text || text.length < 5) return;

    // Check if the interim text matches a bible book name, a number pattern, or is a longer phrase
    const hasReferencePattern = /\d+/.test(text) || /(genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalm|proverbs|ecclesiastes|song|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation)/i.test(text) || text.length >= 15;
    if (!hasReferencePattern) return;

    // Avoid duplicate checks for identical interim segments
    if (text === lastCheckedInterimRef.current) return;
    lastCheckedInterimRef.current = text;

    const checkInterim = async () => {
      try {
        const { references, commands } = await detectScriptures(text);

        for (const ref of (references || [])) {
          if (ref.confidence >= 0.70 && autoMode) {
            const verseData = await fetchVerse(activeTranslation, ref.book, ref.chapter, ref.verseStart, ref.verseEnd);
            
            // Check if we are already showing this verse to avoid double projection
            const isAlreadyShowing = currentVerse &&
              currentVerse.book === verseData.book &&
              currentVerse.chapter === verseData.chapter &&
              currentVerse.verseStart === verseData.verseStart &&
              currentVerse.translation === verseData.translation;

            if (!isAlreadyShowing) {
              await projectVerse({ ...verseData, detectedBy: 'ai', confidence: ref.confidence });
              addCommandLog({
                action: 'auto_projected_interim',
                message: `⚡ Realtime auto-projected: ${verseData.reference}`,
                matchedText: ref.matchedText || text,
              });
            }
            break;
          }
        }

        for (const cmd of (commands || [])) {
          await handleVoiceCommand(cmd);
        }
      } catch (err) {
        console.warn('[Dashboard] Interim process error:', err);
      }
    };

    const handler = setTimeout(checkInterim, 250); // Fast 250ms debounce for interim speech
    return () => clearTimeout(handler);
  }, [interimText, autoMode, activeTranslation, projectVerse, currentVerse]);

  // ── Voice Command Handler ─────────────────────────────────────
  const handleVoiceCommand = async (cmd) => {
    switch (cmd.action) {
      case 'next_verse': {
        const v = await verseNavigator.nextVerse();
        if (v) await projectVerse(v);
        else addToast({ type: 'info', message: 'End of chapter reached' });
        break;
      }
      case 'prev_verse': {
        const v = await verseNavigator.prevVerse();
        if (v) await projectVerse(v);
        break;
      }
      case 'next_chapter': {
        const v = await verseNavigator.nextChapter();
        if (v) await projectVerse(v);
        break;
      }
      case 'prev_chapter': {
        const v = await verseNavigator.prevChapter();
        if (v) await projectVerse(v);
        break;
      }
      case 'clear_screen': {
        clearCurrentVerse();
        syncService.sendClear();
        addToast({ type: 'info', message: 'Screen cleared' });
        break;
      }
      case 'repeat_verse': {
        const v = await verseNavigator.repeatVerse();
        if (v) await projectVerse(v);
        break;
      }
      case 'switch_translation': {
        const t = cmd.params?.translation?.toUpperCase();
        if (t) {
          setActiveTranslation(t);
          syncService.sendTranslation(t);
          if (verseNavigator.hasPosition()) {
            const pos = verseNavigator.getPosition();
            try {
              const v = await fetchVerse(t, pos.book, pos.chapter, pos.verseStart, pos.verseEnd);
              await projectVerse(v);
            } catch {}
          }
          addToast({ type: 'info', message: `Translation → ${t}` });
        }
        break;
      }
    }
  };

  // ── Expose nav to child components via window.__sf ────────────
  useEffect(() => {
    window.__sf = {
      project: projectVerse,
      next: async () => { const v = await verseNavigator.nextVerse(); if (v) await projectVerse(v); },
      prev: async () => { const v = await verseNavigator.prevVerse(); if (v) await projectVerse(v); },
      nextChapter: async () => { const v = await verseNavigator.nextChapter(); if (v) await projectVerse(v); },
      prevChapter: async () => { const v = await verseNavigator.prevChapter(); if (v) await projectVerse(v); },
      repeat: async () => { const v = await verseNavigator.repeatVerse(); if (v) await projectVerse(v); },
      clear: () => { clearCurrentVerse(); syncService.sendClear(); },
    };

    // Global keyboard navigation
    const handleKeyDown = async (e) => {
      // Ignore if typing in an input
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowRight' || e.key === '>' || e.key === '.') {
        e.preventDefault();
        const v = await verseNavigator.nextVerse();
        if (v) await projectVerse(v);
      } else if (e.key === 'ArrowLeft' || e.key === '<' || e.key === ',') {
        e.preventDefault();
        const v = await verseNavigator.prevVerse();
        if (v) await projectVerse(v);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projectVerse, isLive]);

  // ── Generate Sermon Notes ────────────────────────────────────
  const handleGenerateNotes = async () => {
    const fullText = transcriptEntries.map(e => e.text).join(' ');
    if (fullText.length < 80) {
      addToast({ type: 'warning', message: 'Not enough transcript yet — keep listening' });
      return;
    }
    setGeneratingNotes(true);
    try {
      const notes = await generateSermonNotes(fullText);
      if (notes) {
        addSermonNote({ ...notes, generatedAt: new Date().toISOString() });
        setActiveTab('sermon');
        addToast({ type: 'success', message: '📝 Sermon notes generated!' });
      }
    } catch { addToast({ type: 'error', message: 'Notes generation failed' }); }
    setGeneratingNotes(false);
  };

  // ── Open display windows ─────────────────────────────────────
  const openDisplay = () => {
    const w = window.open('/display', 'SanctiFlow_Display', 'width=1920,height=1080');
    if (!w) addToast({ type: 'warning', message: 'Pop-up blocked — allow pop-ups for this site' });
  };
  const openOverlay = () => {
    const w = window.open('/overlay', 'SanctiFlow_Overlay', 'width=1920,height=1080');
    if (!w) addToast({ type: 'warning', message: 'Pop-up blocked — allow pop-ups for this site' });
  };

  const handleLogout = () => { speechService.stop(); logout(); navigate('/login'); };

  // ── AI status indicator ──────────────────────────────────────
  const aiStatusConfig = {
    idle:       { color: geminiReady ? '#22c55e' : '#475569', label: geminiReady ? 'AI Ready' : 'AI Offline', glow: false },
    processing: { color: '#f5c842', label: 'Analyzing…', glow: true },
    error:      { color: '#ef4444', label: quotaWarning ? 'Quota Limit' : 'AI Error', glow: false },
  };
  const aiConf = aiStatusConfig[aiStatus] || aiStatusConfig.idle;

  return (
    <div className="dashboard-layout">

      {/* ╔════════════════════════════════╗
          ║         SIDEBAR                ║
          ╚════════════════════════════════╝ */}
      <aside className="sidebar-navigation">
        {/* Logo mark */}
        <div className="logo-mark" style={{
          width: 38, height: 38, borderRadius: 11, marginBottom: 14,
          background: 'linear-gradient(135deg,#f5c842,#e07b39)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, fontWeight: 900, color: '#1a1000',
          boxShadow: '0 0 24px rgba(245,200,66,0.35)',
          flexShrink: 0,
        }}>S</div>

        {SIDEBAR_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
            style={{
              width: 52, height: 52, borderRadius: 13, border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, fontSize: 19, flexShrink: 0,
              background: activeTab === tab.id ? 'rgba(245,200,66,0.1)' : 'transparent',
              color: activeTab === tab.id ? '#f5c842' : 'rgba(255,255,255,0.28)',
              transition: 'all 0.18s ease',
              boxShadow: activeTab === tab.id ? 'inset 0 0 0 1px rgba(245,200,66,0.2)' : 'none',
            }}
          >
            {tab.icon}
            <span style={{ fontSize: 8, letterSpacing: '0.04em', fontWeight: 700, lineHeight: 1 }}>
              {tab.label}
            </span>
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Connected screens badge */}
        <div className="screens-badge" title={`${connectedScreens} screen(s) connected`} style={{
          width: 36, height: 20, borderRadius: 10, marginBottom: 4,
          background: connectedScreens > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: connectedScreens > 0 ? '#22c55e' : 'rgba(255,255,255,0.2)',
          fontWeight: 700,
        }}>
          {connectedScreens > 0 ? `●${connectedScreens}` : '○'}
        </div>

        <button onClick={() => navigate('/settings')} title="Settings" style={{
          width: 52, height: 44, borderRadius: 13, border: 'none', cursor: 'pointer',
          background: 'transparent', color: 'rgba(255,255,255,0.28)', fontSize: 19,
          transition: 'all 0.18s ease', flexShrink: 0,
        }}>⚙</button>

        <button onClick={handleLogout} title="Logout" style={{
          width: 52, height: 44, borderRadius: 13, border: 'none', cursor: 'pointer',
          background: 'transparent', color: 'rgba(255,255,255,0.18)', fontSize: 16,
          transition: 'all 0.18s ease', flexShrink: 0,
        }}>↩</button>
      </aside>

      {/* ╔════════════════════════════════╗
          ║        MAIN CONTENT            ║
          ╚════════════════════════════════╝ */}
      <div className="main-content-container">

        {/* TOP BAR */}
        <div className="top-header-bar">
          {/* Left: title + status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: 'white', whiteSpace: 'nowrap' }}>
              {churchName || 'SanctiFlow'}
            </span>
            <span style={{ padding: '1px 7px', borderRadius: 20, background: 'rgba(245,200,66,0.1)', color: '#f5c842', fontSize: 9, fontWeight: 800, letterSpacing: '0.08em' }}>
              PRO
            </span>
            {socketConnected ? (
              <span style={{ padding: '1px 7px', borderRadius: 20, background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontSize: 9, fontWeight: 800, letterSpacing: '0.04em' }}>
                ● Connected
              </span>
            ) : (
              <span style={{ padding: '1px 7px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', animation: 'pulse-dot 1.5s infinite' }}>
                ● Offline
              </span>
            )}
            {quotaWarning && (
              <span style={{ padding: '1px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 9, fontWeight: 700 }}>
                ⚠ QUOTA — retrying
              </span>
            )}
          </div>

          {/* Right: controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* AI indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: aiConf.color,
                boxShadow: aiConf.glow ? `0 0 10px ${aiConf.color}` : 'none',
                animation: aiConf.glow ? 'pulse-dot 1s infinite' : 'none',
              }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                {aiConf.label}
              </span>
            </div>

            {/* Generate Notes */}
            <button onClick={handleGenerateNotes} disabled={generatingNotes} style={{
              padding: '4px 11px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)',
              fontSize: 10, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              {generatingNotes
                ? <><span style={{ width: 10, height: 10, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#f5c842', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> Generating</>
                : '📝 Notes'
              }
            </button>

            {/* Audience Display */}
            <button onClick={openDisplay} id="open-display-btn" style={{
              padding: '4px 12px', borderRadius: 7,
              background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.18)',
              color: '#f5c842', fontSize: 10, fontWeight: 800, cursor: 'pointer',
            }}>🖥 Display</button>

            {/* OBS Overlay */}
            <button onClick={openOverlay} id="open-overlay-btn" style={{
              padding: '4px 12px', borderRadius: 7,
              background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)',
              color: '#a78bfa', fontSize: 10, fontWeight: 800, cursor: 'pointer',
            }}>📺 OBS</button>
          </div>
        </div>

        {/* ── TAB CONTENT ──────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

          {/* LIVE TAB */}
          {activeTab === 'main' && (
            <div className="dashboard-grid">
              {/* R1C1: Voice */}
              <div style={{ overflow: 'hidden', minHeight: 0 }}>
                <VoicePanel />
              </div>
              {/* R1C2: Scripture Detections */}
              <div style={{ overflow: 'hidden', minHeight: 0 }}>
                <ScripturePanel onProject={projectVerse} />
              </div>
              {/* R1-2 C3: Display Preview (spans 2 rows) */}
              <div style={{ gridRow: '1 / 3', overflow: 'hidden', minHeight: 0 }}>
                <DisplayPreview onProject={projectVerse} />
              </div>
              {/* R2C1: Approval Queue */}
              <div style={{ overflow: 'hidden', minHeight: 0 }}>
                <ApprovalQueue onProject={projectVerse} />
              </div>
              {/* R2C2: AI Activity */}
              <div style={{ overflow: 'hidden', minHeight: 0 }}>
                <CommandLog />
              </div>
            </div>
          )}

          {activeTab === 'queue'   && <div style={{ padding: 8, height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}><QueuePanel onProject={projectVerse} /></div>}
          {activeTab === 'history' && <div style={{ padding: 8, height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}><HistoryPanel onProject={projectVerse} /></div>}
          {activeTab === 'sermon'  && <div style={{ padding: 8, height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}><SermonNotes onGenerateMore={handleGenerateNotes} isGenerating={generatingNotes} /></div>}
          {activeTab === 'stats'   && <div style={{ padding: 8, height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}><SessionStats /></div>}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:0.5; transform:scale(1.4); }
        }
      `}</style>
    </div>
  );
}
