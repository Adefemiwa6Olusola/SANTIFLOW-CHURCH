import { BIBLE_BOOKS, BOOK_ABBREVIATIONS, APP_CONFIG } from '../utils/constants';
import { getCachedChapter, setCachedChapter } from './dbService';

// Two-layer cache: fast memory + persistent IndexedDB
const memoryCache = new Map();

// ── Book Name Resolution ────────────────────────────────────────────────────
export function resolveBookName(input) {
  if (!input) return null;
  const normalized = input.trim();

  // 1. Direct exact match
  if (BIBLE_BOOKS[normalized]) return normalized;

  // 2. Case-insensitive exact match
  const lower = normalized.toLowerCase();
  const found = Object.keys(BIBLE_BOOKS).find(b => b.toLowerCase() === lower);
  if (found) return found;

  // 3. Abbreviation match (strip periods & spaces)
  const abbrev = lower.replace(/[.\s]/g, '');
  if (BOOK_ABBREVIATIONS[abbrev]) return BOOK_ABBREVIATIONS[abbrev];

  // 4. Partial prefix match
  const partial = Object.keys(BIBLE_BOOKS).find(b =>
    b.toLowerCase().startsWith(lower)
  );
  if (partial) return partial;

  // 5. Fuzzy: contains match
  const fuzzy = Object.keys(BIBLE_BOOKS).find(b =>
    b.toLowerCase().includes(lower) || lower.includes(b.toLowerCase().slice(0, 4))
  );
  return fuzzy || null;
}

function cacheKey(translation, bookId, chapter) {
  return `${translation}:${bookId}:${chapter}`;
}

// ── Fetch Chapter ────────────────────────────────────────────────────────────
export async function fetchChapter(translation, bookName, chapter) {
  const resolvedBook = resolveBookName(bookName);
  if (!resolvedBook) throw new Error(`Unknown Bible book: "${bookName}"`);

  const bookId = BIBLE_BOOKS[resolvedBook];
  const key = cacheKey(translation, bookId, chapter);

  // Memory cache hit
  if (memoryCache.has(key)) return memoryCache.get(key);

  // IndexedDB cache hit
  try {
    const dbCache = await getCachedChapter(key);
    if (dbCache && dbCache.verses?.length > 0) {
      memoryCache.set(key, dbCache);
      return dbCache;
    }
  } catch {}

  // API fetch
  const url = `${APP_CONFIG.BIBLE_API_BASE}/get-text/${translation}/${bookId}/${chapter}/`;

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Bible API returned ${response.status} for ${resolvedBook} ${chapter} (${translation})`);
  }

  const data = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`No verses found for ${resolvedBook} ${chapter} in ${translation}`);
  }

  const result = {
    book: resolvedBook,
    bookId,
    chapter: parseInt(chapter),
    translation,
    verses: data.map(v => ({
      verse: v.verse,
      // Strip Strong's numbers (<S>...</S>), HTML tags, extra whitespace
      text: v.text
        .replace(/<S>\d+<\/S>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    })),
  };

  // Save to both caches
  memoryCache.set(key, result);
  setCachedChapter(key, result).catch(() => {}); // non-blocking

  return result;
}

// ── Fetch Verse(s) ───────────────────────────────────────────────────────────
export async function fetchVerse(translation, bookName, chapter, verseStart, verseEnd) {
  const chapterData = await fetchChapter(translation, bookName, chapter);
  const start = parseInt(verseStart) || 1;
  const end = parseInt(verseEnd) || start;

  const verses = chapterData.verses.filter(v => v.verse >= start && v.verse <= end);

  if (verses.length === 0) {
    throw new Error(`Verse not found: ${bookName} ${chapter}:${start}`);
  }

  const text = verses.map(v => v.text).join(' ');
  const reference = end !== start
    ? `${chapterData.book} ${chapter}:${start}-${end}`
    : `${chapterData.book} ${chapter}:${start}`;

  return {
    text,
    reference,
    book: chapterData.book,
    chapter: parseInt(chapter),
    verseStart: start,
    verseEnd: end,
    translation,
    verses,
  };
}

// ── Parse Reference String ──────────────────────────────────────────────────
export function parseReference(refString) {
  if (!refString) return null;

  // Normalize: remove extra whitespace, trim
  const clean = refString.trim().replace(/\s+/g, ' ');

  // Pattern: "John 3:16", "1 Corinthians 13:4-7", "Psalm 23", "Genesis 1:1-3"
  // Also handles: "John3:16", "jn 3 16"
  const patterns = [
    // Standard: "Book Chapter:Verse-Verse"
    /^(\d?\s*[A-Za-z]+(?:\s+of\s+[A-Za-z]+)?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/i,
    // With dot: "John.3.16"
    /^(\d?\s*[A-Za-z]+)\.(\d+)\.(\d+)(?:-(\d+))?$/i,
  ];

  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (!match) continue;

    const bookName = resolveBookName(match[1]?.trim());
    if (!bookName) continue;

    const chapter = parseInt(match[2]);
    const verseStart = match[3] ? parseInt(match[3]) : 1;
    const verseEnd = match[4] ? parseInt(match[4]) : (match[3] ? verseStart : null);

    if (isNaN(chapter) || chapter < 1 || chapter > 150) continue;

    return {
      book: bookName,
      chapter,
      verseStart,
      verseEnd,
      isFullChapter: !match[3],
    };
  }

  return null;
}

// ── Bible Search ─────────────────────────────────────────────────────────────
export async function searchBible(translation, query) {
  try {
    const url = `${APP_CONFIG.BIBLE_API_BASE}/search/${translation}/?search=${encodeURIComponent(query)}&limit=20`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Search failed: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : (data.results || []);
  } catch (error) {
    console.error('[BibleService] Search error:', error);
    return [];
  }
}

// ── Preload Adjacent Verses (for fast navigation) ────────────────────────────
export async function preloadAdjacent(translation, bookName, chapter) {
  // Fire and forget — warms up cache
  const nextChapter = parseInt(chapter) + 1;
  const prevChapter = parseInt(chapter) - 1;
  if (prevChapter >= 1) fetchChapter(translation, bookName, prevChapter).catch(() => {});
  fetchChapter(translation, bookName, nextChapter).catch(() => {});
}

// ── Clear Memory Cache ───────────────────────────────────────────────────────
export function clearMemoryCache() {
  memoryCache.clear();
}
