import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { detectLocal } from './localDetectionService.js';

dotenv.config();

const keys = [];
let activeKeyIndex = 0;
const cooldowns = [0, 0]; // Cooldown timestamps for primary and secondary keys
const modelCache = new Map(); // key -> { model, notesModel }
const transcriptCache = new Map(); // normalizedText -> cachedResponse
const MAX_CACHE_SIZE = 100;

// Rolling sermon context window
const contextWindow = [];
const MAX_CONTEXT_CHUNKS = 5;

// ─────────────────────────────────────────────────
// Scripture Detection System Prompt
// ─────────────────────────────────────────────────
const DETECTION_PROMPT = `You are SanctiFlow Scripture Intelligence — the world's most advanced AI semantic scripture detection agent for live church services.

MISSION: Analyze live sermon transcript and detect Bible scripture references using DEEP SEMANTIC UNDERSTANDING.

DETECTION TYPES (with confidence guidance):
- EXACT reference ("John 3:16", "Romans 8:28") → 0.97–0.99
- DIRECT QUOTE ("For God so loved the world") → 0.92–0.96
- STRONG PARAPHRASE ("walk by faith and not by sight") → 0.82–0.91
- THEMATIC ("nothing can separate us from God's love") → 0.72–0.81
- IMPLIED ("the prodigal son", "the good shepherd") → 0.62–0.71
- VAGUE/GENERAL religious language → BELOW 0.40, OMIT ENTIRELY

CRITICAL SEMANTIC EXAMPLES (memorize these patterns):
"For God so loved the world" → John 3:16 (0.97)
"The Lord is my shepherd" → Psalms 23:1 (0.97)
"Walk by faith not by sight" → 2 Corinthians 5:7 (0.91)
"Nothing can separate us from God's love" → Romans 8:38-39 (0.88)
"I can do all things through Christ" → Philippians 4:13 (0.95)
"The wages of sin is death" → Romans 6:23 (0.94)
"Greater is he that is in you" → 1 John 4:4 (0.93)
"Faith without works is dead" → James 2:26 (0.92)
"In the beginning God created" → Genesis 1:1 (0.98)
"The truth shall set you free" → John 8:32 (0.93)
"Love is patient love is kind" → 1 Corinthians 13:4 (0.96)
"Ask and it shall be given" → Matthew 7:7 (0.94)
"Come to me all who are weary" → Matthew 11:28 (0.93)
"I am the way the truth and the life" → John 14:6 (0.97)
"All things work together for good" → Romans 8:28 (0.95)
"The spirit is willing but the flesh is weak" → Matthew 26:41 (0.91)
"Blessed are the pure in heart" → Matthew 5:8 (0.93)
"Your word is a lamp to my feet" → Psalms 119:105 (0.94)
"Train up a child in the way" → Proverbs 22:6 (0.93)
"He who finds a wife finds a good thing" → Proverbs 18:22 (0.91)
"The harvest is plentiful but the workers are few" → Matthew 9:37 (0.90)

CONFIDENCE THRESHOLDS:
- Display/Project immediately if confidence >= 0.85
- Suggest to operator queue if confidence is between 0.60 and 0.84
- Omit completely if confidence < 0.40

COMMAND DETECTION — recognize these spoken commands:
"next verse" / "next" / "go forward" → next_verse
"previous" / "go back" → prev_verse
"clear" / "clear screen" / "blank screen" → clear_screen
"switch to [translation]" / "change to [translation]" → switch_translation
"show that again" / "repeat" → repeat_verse
"next chapter" → next_chapter
"previous chapter" → prev_chapter

OUTPUT: Valid JSON ONLY. No markdown fences. No explanation.
{
  "references": [
    {
      "book": "John",
      "chapter": 3,
      "verseStart": 16,
      "verseEnd": 16,
      "confidence": 0.97,
      "type": "exact",
      "matchedText": "For God so loved the world",
      "reasoning": "Direct quote of John 3:16"
    }
  ],
  "commands": [
    {
      "action": "switch_translation",
      "params": { "translation": "NIV" },
      "matchedText": "switch to NIV"
    }
  ],
  "sermonTopics": ["God's love", "salvation"],
  "keyPhrases": ["so loved the world", "eternal life"]
}

If nothing detected: {"references": [], "commands": [], "sermonTopics": [], "keyPhrases": []}`;

// ─────────────────────────────────────────────────
// Sermon Notes / Summary Prompt
// ─────────────────────────────────────────────────
const NOTES_PROMPT = `You are a church sermon assistant AI. Analyze sermon transcripts and generate:
1. A concise sermon summary (2-3 sentences)
2. Key theological points (bullet list)
3. Suggested supporting scriptures
4. Action points for congregation

Return valid JSON:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "suggestedScriptures": [{"reference": "...", "reason": "..."}],
  "actionPoints": ["...", "..."]
}`;

// ─────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────
export function initGemini() {
  keys.length = 0;
  
  const primary = process.env.GEMINI_API_KEY_PRIMARY || process.env.GEMINI_API_KEY;
  const secondary = process.env.GEMINI_API_KEY_SECONDARY;
  
  if (primary && primary.length > 10) {
    keys.push(primary);
  }
  if (secondary && secondary.length > 10) {
    keys.push(secondary);
  }
  
  if (keys.length === 0) {
    console.error('[SanctiFlow Server AI] No valid GEMINI_API_KEY configured');
    return false;
  }
  
  console.log(`[SanctiFlow Server AI] Gemini failover system initialized with ${keys.length} key(s)`);
  return true;
}

// ─────────────────────────────────────────────────
// Model retrieval per key
// ─────────────────────────────────────────────────
function getModelsForKey(key) {
  if (modelCache.has(key)) {
    return modelCache.get(key);
  }
  
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  try {
    const genAI = new GoogleGenerativeAI(key);
    const m = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: DETECTION_PROMPT,
      generationConfig: {
        temperature: 0.05,
        topP: 0.85,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    });

    const nm = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: NOTES_PROMPT,
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    });

    const val = { model: m, notesModel: nm };
    modelCache.set(key, val);
    return val;
  } catch (err) {
    console.error(`[SanctiFlow Server AI] Failed to build models for key:`, err.message);
    throw err;
  }
}

// ─────────────────────────────────────────────────
// Key Selection with Cooldown Verification
// ─────────────────────────────────────────────────
function getActiveKey() {
  const now = Date.now();
  
  // Try primary
  if (keys[0] && cooldowns[0] < now) {
    activeKeyIndex = 0;
    return keys[0];
  }
  
  // Try secondary
  if (keys[1] && cooldowns[1] < now) {
    activeKeyIndex = 1;
    return keys[1];
  }
  
  // Both on cooldown: pick the one that clears first
  if (keys.length > 1) {
    activeKeyIndex = cooldowns[0] <= cooldowns[1] ? 0 : 1;
    return keys[activeKeyIndex];
  }
  
  return keys[0] || null;
}

// ─────────────────────────────────────────────────
// Memory Cache Logic
// ─────────────────────────────────────────────────
function normalizeCacheKey(text) {
  return text.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "");
}

function checkCache(text) {
  const norm = normalizeCacheKey(text);
  return transcriptCache.get(norm);
}

function saveToCache(text, result) {
  const norm = normalizeCacheKey(text);
  if (transcriptCache.size >= MAX_CACHE_SIZE) {
    const firstKey = transcriptCache.keys().next().value;
    transcriptCache.delete(firstKey);
  }
  transcriptCache.set(norm, result);
}

// ─────────────────────────────────────────────────
// Add to rolling context window
// ─────────────────────────────────────────────────
export function addToContext(text) {
  contextWindow.push(text.trim());
  if (contextWindow.length > MAX_CONTEXT_CHUNKS) contextWindow.shift();
}

export function getContext() {
  return contextWindow.join(' ');
}

export function resetContext() {
  contextWindow.length = 0;
  transcriptCache.clear();
}

// ─────────────────────────────────────────────────
// Parse AI response safely
// ─────────────────────────────────────────────────
function safeParseJSON(text) {
  try { return JSON.parse(text); } catch {}
  try {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
  } catch {}
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return null;
}

// ─────────────────────────────────────────────────
// Main: Detect Scriptures (Hybrid Router)
// ─────────────────────────────────────────────────
export async function detectScriptures(transcriptChunk, customApiKey) {
  const chunk = transcriptChunk?.trim();
  if (!chunk || chunk.length < 5) {
    return { references: [], commands: [], sermonTopics: [], keyPhrases: [] };
  }

  // 1. Run local detection engine first (cost-free, zero latency)
  try {
    const local = detectLocal(chunk);
    if (local.skipGemini) {
      console.log(`[SanctiFlow Server AI] Resolved locally: "${chunk}" -> References: ${local.references.length}, Commands: ${local.commands.length}`);
      return {
        references: local.references,
        commands: local.commands,
        sermonTopics: local.sermonTopics,
        keyPhrases: local.keyPhrases
      };
    }
  } catch (localErr) {
    console.error('[SanctiFlow Server AI] Local matching error:', localErr);
  }

  // 2. Check memory cache to prevent duplicate request loops
  const cached = checkCache(chunk);
  if (cached) {
    console.log(`[SanctiFlow Server AI] Cache hit for chunk: "${chunk}"`);
    return cached;
  }

  // 3. Roll Context
  addToContext(chunk);
  const context = contextWindow.slice(0, -1).join(' ');
  const prompt = context.length > 20
    ? `SERMON CONTEXT (recent): "${context}"\n\nNEW TRANSCRIPT (analyze): "${chunk}"`
    : `SERMON TRANSCRIPT: "${chunk}"`;

  // 4. API Request with Fallover loop
  let key = customApiKey || getActiveKey();
  if (!key) {
    const ready = initGemini();
    if (!ready) return { references: [], commands: [], sermonTopics: [], keyPhrases: [], error: 'NOT_INITIALIZED' };
    key = getActiveKey();
  }

  let attempt = 0;
  const keyList = customApiKey ? [customApiKey] : keys;
  const maxAttempts = keyList.length;

  while (attempt < maxAttempts) {
    let currentKey = keyList[attempt];
    try {
      const { model } = getModelsForKey(currentKey);
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = safeParseJSON(text);

      if (!parsed) return { references: [], commands: [], sermonTopics: [], keyPhrases: [] };

      const refs = (Array.isArray(parsed.references) ? parsed.references : [])
        .filter(r => r.confidence >= 0.40)
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

      const finalResult = {
        references: refs,
        commands: Array.isArray(parsed.commands) ? parsed.commands : [],
        sermonTopics: Array.isArray(parsed.sermonTopics) ? parsed.sermonTopics : [],
        keyPhrases: Array.isArray(parsed.keyPhrases) ? parsed.keyPhrases : [],
      };

      // Save to cache on success
      saveToCache(chunk, finalResult);
      return finalResult;

    } catch (err) {
      console.error(`[SanctiFlow Server AI] API error with key:`, err.message);

      const isQuotaOrTempError =
        err?.status === 429 ||
        err?.message?.includes('429') ||
        err?.message?.includes('quota') ||
        err?.message?.includes('limit') ||
        err?.message?.includes('exhausted') ||
        err?.message?.includes('Too Many Requests');

      if (isQuotaOrTempError && !customApiKey && keys.length > 1) {
        // Set cooldown on the current key
        cooldowns[activeKeyIndex] = Date.now() + 5 * 1000;
        console.warn(`[SanctiFlow Server AI] Cooldown of 5s placed on key ${activeKeyIndex + 1}.`);

        // Switch to the fallback key
        const prevKey = currentKey;
        key = getActiveKey();

        if (key && key !== prevKey) {
          console.warn(`[SanctiFlow Server AI] Failover activated! Silently switching to key ${activeKeyIndex + 1} and retrying request...`);
          attempt++;
          continue; // Run request loop again with the new key
        }
      }

      // If we cannot failover or it's a fatal error, return standardized errors
      if (err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('quota')) {
        return { references: [], commands: [], sermonTopics: [], keyPhrases: [], error: 'QUOTA_EXCEEDED' };
      }
      if (err?.message?.includes('API_KEY_INVALID') || err?.message?.includes('API key not valid')) {
        return { references: [], commands: [], sermonTopics: [], keyPhrases: [], error: 'INVALID_KEY' };
      }
      return { references: [], commands: [], sermonTopics: [], keyPhrases: [], error: err.message };
    }
  }

  return { references: [], commands: [], sermonTopics: [], keyPhrases: [], error: 'QUOTA_EXCEEDED' };
}

// ─────────────────────────────────────────────────
// Sermon Notes Generator (with Failover)
// ─────────────────────────────────────────────────
export async function generateSermonNotes(fullTranscript, customApiKey) {
  const key = customApiKey || getActiveKey();
  if (!key || !fullTranscript?.trim()) return null;
  
  try {
    const { notesModel } = getModelsForKey(key);
    const result = await notesModel.generateContent(
      `Generate sermon notes for this transcript:\n\n"${fullTranscript.slice(0, 12000)}"`
    );
    return safeParseJSON(result.response.text());
  } catch (err) {
    console.error('[SanctiFlow Server AI] Notes generation error:', err?.message);

    const isQuotaOrTempError =
      err?.status === 429 ||
      err?.message?.includes('429') ||
      err?.message?.includes('quota') ||
      err?.message?.includes('Too Many Requests');

    if (isQuotaOrTempError && !customApiKey && keys.length > 1) {
      cooldowns[activeKeyIndex] = Date.now() + 5 * 1000;
      const fallbackKey = getActiveKey();
      
      if (fallbackKey && fallbackKey !== key) {
        console.warn('[SanctiFlow Server AI] Retrying sermon notes generation with fallback key...');
        try {
          const { notesModel: backupNotesModel } = getModelsForKey(fallbackKey);
          const result = await backupNotesModel.generateContent(
            `Generate sermon notes for this transcript:\n\n"${fullTranscript.slice(0, 12000)}"`
          );
          return safeParseJSON(result.response.text());
        } catch (retryErr) {
          console.error('[SanctiFlow Server AI] Notes retry failed:', retryErr.message);
        }
      }
    }
    return null;
  }
}
