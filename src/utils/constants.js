// Bible book names mapped to Bolls Bible API numeric IDs
export const BIBLE_BOOKS = {
  'Genesis': 1, 'Exodus': 2, 'Leviticus': 3, 'Numbers': 4, 'Deuteronomy': 5,
  'Joshua': 6, 'Judges': 7, 'Ruth': 8, '1 Samuel': 9, '2 Samuel': 10,
  '1 Kings': 11, '2 Kings': 12, '1 Chronicles': 13, '2 Chronicles': 14,
  'Ezra': 15, 'Nehemiah': 16, 'Esther': 17, 'Job': 18, 'Psalms': 19,
  'Proverbs': 20, 'Ecclesiastes': 21, 'Song of Solomon': 22, 'Isaiah': 23,
  'Jeremiah': 24, 'Lamentations': 25, 'Ezekiel': 26, 'Daniel': 27,
  'Hosea': 28, 'Joel': 29, 'Amos': 30, 'Obadiah': 31, 'Jonah': 32,
  'Micah': 33, 'Nahum': 34, 'Habakkuk': 35, 'Zephaniah': 36, 'Haggai': 37,
  'Zechariah': 38, 'Malachi': 39, 'Matthew': 40, 'Mark': 41, 'Luke': 42,
  'John': 43, 'Acts': 44, 'Romans': 45, '1 Corinthians': 46,
  '2 Corinthians': 47, 'Galatians': 48, 'Ephesians': 49, 'Philippians': 50,
  'Colossians': 51, '1 Thessalonians': 52, '2 Thessalonians': 53,
  '1 Timothy': 54, '2 Timothy': 55, 'Titus': 56, 'Philemon': 57,
  'Hebrews': 58, 'James': 59, '1 Peter': 60, '2 Peter': 61,
  '1 John': 62, '2 John': 63, '3 John': 64, 'Jude': 65, 'Revelation': 66
};

// Reverse lookup: ID -> name
export const BIBLE_BOOK_NAMES = Object.fromEntries(
  Object.entries(BIBLE_BOOKS).map(([name, id]) => [id, name])
);

// Common abbreviations
export const BOOK_ABBREVIATIONS = {
  'gen': 'Genesis', 'ex': 'Exodus', 'exod': 'Exodus', 'lev': 'Leviticus',
  'num': 'Numbers', 'deut': 'Deuteronomy', 'josh': 'Joshua', 'judg': 'Judges',
  'sam': '1 Samuel', '1sam': '1 Samuel', '2sam': '2 Samuel',
  '1ki': '1 Kings', '2ki': '2 Kings', '1kgs': '1 Kings', '2kgs': '2 Kings',
  '1chr': '1 Chronicles', '2chr': '2 Chronicles', 'neh': 'Nehemiah',
  'est': 'Esther', 'ps': 'Psalms', 'psa': 'Psalms', 'psalm': 'Psalms',
  'prov': 'Proverbs', 'eccl': 'Ecclesiastes', 'ecc': 'Ecclesiastes',
  'song': 'Song of Solomon', 'sos': 'Song of Solomon',
  'isa': 'Isaiah', 'jer': 'Jeremiah', 'lam': 'Lamentations',
  'ezek': 'Ezekiel', 'dan': 'Daniel', 'hos': 'Hosea',
  'mic': 'Micah', 'nah': 'Nahum', 'hab': 'Habakkuk',
  'zeph': 'Zephaniah', 'hag': 'Haggai', 'zech': 'Zechariah',
  'mal': 'Malachi', 'matt': 'Matthew', 'mat': 'Matthew', 'mk': 'Mark',
  'lk': 'Luke', 'jn': 'John', 'joh': 'John',
  'rom': 'Romans', '1cor': '1 Corinthians', '2cor': '2 Corinthians',
  'gal': 'Galatians', 'eph': 'Ephesians', 'phil': 'Philippians',
  'php': 'Philippians', 'col': 'Colossians',
  '1thess': '1 Thessalonians', '2thess': '2 Thessalonians',
  '1tim': '1 Timothy', '2tim': '2 Timothy', 'tit': 'Titus',
  'phm': 'Philemon', 'heb': 'Hebrews', 'jas': 'James',
  '1pet': '1 Peter', '2pet': '2 Peter',
  '1jn': '1 John', '2jn': '2 John', '3jn': '3 John',
  'rev': 'Revelation'
};

// Supported translations (Bolls Bible API shortcodes)
export const TRANSLATIONS = [
  { id: 'KJV', name: 'King James Version', shortName: 'KJV' },
  { id: 'NKJV', name: 'New King James Version', shortName: 'NKJV' },
  { id: 'NLT', name: 'New Living Translation', shortName: 'NLT' },
  { id: 'NIV', name: 'New International Version', shortName: 'NIV' },
  { id: 'ESV', name: 'English Standard Version', shortName: 'ESV' },
  { id: 'AMP', name: 'Amplified Bible', shortName: 'AMP' },
  { id: 'MSG', name: 'The Message', shortName: 'MSG' },
  { id: 'YLT', name: "Young's Literal Translation", shortName: 'YLT' },
  { id: 'WEB', name: 'World English Bible', shortName: 'WEB' },
];

// Voice command patterns
export const VOICE_COMMANDS = {
  NEXT_VERSE: ['next verse', 'next', 'go forward'],
  PREV_VERSE: ['previous verse', 'previous', 'go back'],
  CLEAR: ['clear screen', 'clear', 'hide verse', 'blank'],
  FULLSCREEN: ['fullscreen', 'full screen'],
  SHOW: ['show verse', 'show'],
};

// Worship backgrounds
export const BACKGROUNDS = [
  { id: 'rays', name: 'Light Rays', url: '/backgrounds/rays.png' },
  { id: 'nebula', name: 'Cosmic Nebula', url: '/backgrounds/nebula.png' },
  { id: 'golden', name: 'Golden Warmth', url: '/backgrounds/golden.png' },
  { id: 'cross', name: 'Subtle Cross', url: '/backgrounds/cross.png' },
  { id: 'dark', name: 'Pure Dark', url: null },
];

// App configuration
export const APP_CONFIG = {
  APP_NAME: 'SanctiFlow',
  APP_TAGLINE: 'AI Church Media OS',
  GEMINI_MODEL: import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash',
  DEFAULT_TRANSLATION: import.meta.env.VITE_DEFAULT_TRANSLATION || 'KJV',
  TRANSCRIPT_CHUNK_INTERVAL: 4000, // ms between AI processing chunks
  MIN_CONFIDENCE: 0.4, // minimum confidence to show scripture
  AUTO_SEND_CONFIDENCE: 0.85, // auto-project threshold
  BIBLE_API_BASE: 'https://bolls.life',
};
