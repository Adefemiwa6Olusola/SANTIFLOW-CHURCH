// localDetectionService.js
// High-performance local processing engine for voice commands,
// explicit regex scripture citation parsing, and token-overlap semantic phrase matching.

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

const STOPWORDS = new Set([
  'the', 'and', 'a', 'of', 'to', 'in', 'is', 'that', 'it', 'he', 'was', 'for', 
  'on', 'are', 'as', 'with', 'his', 'they', 'i', 'um', 'ah', 'like', 'you', 'know', 'we', 'our', 'us'
]);

// Escape regex utility
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Dynamically compile Book Name and Abbreviation Regex Pattern
const bookNamesPattern = [
  ...Object.keys(BIBLE_BOOKS),
  ...Object.keys(BOOK_ABBREVIATIONS)
].map(escapeRegExp).join('|');

const REFERENCE_REGEX = new RegExp(
  `\\b(${bookNamesPattern})\\b(?:\\s+chapter)?\\s+(\\d+)(?:\\s*(?::|verse|vs?|;)\\s*(\\d+)(?:\\s*(?:-|to|through)\\s*(\\d+))?|\\s+(\\d+)(?:\\s*(?:-|to|through)\\s*(\\d+))?)(?:\\b|$)`,
  'gi'
);

// Pre-compiled list of the 45+ most popular scriptures preached in churches
const POPULAR_VERSES = [
  {
    book: "John", chapter: 3, verseStart: 16, verseEnd: 16,
    phrases: [
      "for God so loved the world that he gave his only begotten son",
      "God so loved the world",
      "whoever believes in him should not perish but have everlasting life",
      "should not perish but have eternal life"
    ]
  },
  {
    book: "Psalms", chapter: 23, verseStart: 1, verseEnd: 1,
    phrases: [
      "the Lord is my shepherd I shall not want",
      "the Lord is my shepherd"
    ]
  },
  {
    book: "2 Corinthians", chapter: 5, verseStart: 7, verseEnd: 7,
    phrases: [
      "for we walk by faith not by sight",
      "we walk by faith and not by sight",
      "walk by faith not by sight"
    ]
  },
  {
    book: "Romans", chapter: 8, verseStart: 28, verseEnd: 28,
    phrases: [
      "all things work together for good to them that love God",
      "all things work together for good"
    ]
  },
  {
    book: "Philippians", chapter: 4, verseStart: 13, verseEnd: 13,
    phrases: [
      "I can do all things through Christ which strengtheneth me",
      "I can do all things through Christ who strengthens me",
      "I can do all things through Christ"
    ]
  },
  {
    book: "Romans", chapter: 6, verseStart: 23, verseEnd: 23,
    phrases: [
      "the wages of sin is death but the gift of God is eternal life",
      "the wages of sin is death"
    ]
  },
  {
    book: "1 John", chapter: 4, verseStart: 4, verseEnd: 4,
    phrases: [
      "greater is he that is in you than he that is in the world",
      "greater is he that is in you"
    ]
  },
  {
    book: "James", chapter: 2, verseStart: 26, verseEnd: 26,
    phrases: [
      "faith without works is dead",
      "as the body without the spirit is dead so faith without works is dead"
    ]
  },
  {
    book: "Genesis", chapter: 1, verseStart: 1, verseEnd: 1,
    phrases: [
      "in the beginning God created the heaven and the earth",
      "in the beginning God created the heavens and the earth",
      "in the beginning God created"
    ]
  },
  {
    book: "John", chapter: 8, verseStart: 32, verseEnd: 32,
    phrases: [
      "ye shall know the truth and the truth shall make you free",
      "you shall know the truth and the truth shall set you free",
      "the truth shall set you free"
    ]
  },
  {
    book: "1 Corinthians", chapter: 13, verseStart: 4, verseEnd: 4,
    phrases: [
      "charity suffereth long and is kind charity envieth not",
      "love is patient love is kind love does not envy",
      "love is patient love is kind"
    ]
  },
  {
    book: "Matthew", chapter: 7, verseStart: 7, verseEnd: 7,
    phrases: [
      "ask and it shall be given you seek and ye shall find knock and it shall be opened",
      "ask and it shall be given seek and you shall find"
    ]
  },
  {
    book: "Matthew", chapter: 11, verseStart: 28, verseEnd: 28,
    phrases: [
      "come to me all ye that labor and are heavy laden and I will give you rest",
      "come to me all who are weary and heavy laden"
    ]
  },
  {
    book: "John", chapter: 14, verseStart: 6, verseEnd: 6,
    phrases: [
      "I am the way the truth and the life no man cometh unto the Father but by me",
      "I am the way the truth and the life"
    ]
  },
  {
    book: "Matthew", chapter: 26, verseStart: 41, verseEnd: 41,
    phrases: [
      "watch and pray that ye enter not into temptation",
      "the spirit indeed is willing but the flesh is weak",
      "the spirit is willing but the flesh is weak"
    ]
  },
  {
    book: "Matthew", chapter: 5, verseStart: 8, verseEnd: 8,
    phrases: [
      "blessed are the pure in heart for they shall see God",
      "blessed are the pure in heart"
    ]
  },
  {
    book: "Psalms", chapter: 119, verseStart: 105, verseEnd: 105,
    phrases: [
      "thy word is a lamp unto my feet and a light unto my path",
      "your word is a lamp to my feet and a light to my path",
      "your word is a lamp to my feet"
    ]
  },
  {
    book: "Proverbs", chapter: 22, verseStart: 6, verseEnd: 6,
    phrases: [
      "train up a child in the way he should go and when he is old he will not depart",
      "train up a child in the way he should go"
    ]
  },
  {
    book: "Proverbs", chapter: 18, verseStart: 22, verseEnd: 22,
    phrases: [
      "whoso findeth a wife findeth a good thing and obtaineth favor",
      "he who finds a wife finds a good thing and obtains favor"
    ]
  },
  {
    book: "Matthew", chapter: 9, verseStart: 37, verseEnd: 37,
    phrases: [
      "the harvest truly is plenteous but the laborers are few",
      "the harvest is plentiful but the workers are few"
    ]
  },
  {
    book: "Proverbs", chapter: 3, verseStart: 5, verseEnd: 6,
    phrases: [
      "trust in the Lord with all thine heart and lean not unto thine own understanding",
      "trust in the Lord with all your heart and lean not on your own understanding",
      "in all thy ways acknowledge him and he shall direct thy paths",
      "in all your ways acknowledge him and he will make your paths straight"
    ]
  },
  {
    book: "Joshua", chapter: 1, verseStart: 9, verseEnd: 9,
    phrases: [
      "have not I commanded thee be strong and of a good courage be not afraid",
      "be strong and courageous do not be afraid",
      "the Lord thy God is with thee whithersoever thou goest",
      "the Lord your God is with you wherever you go"
    ]
  },
  {
    book: "Isaiah", chapter: 41, verseStart: 10, verseEnd: 10,
    phrases: [
      "fear thou not for I am with thee be not dismayed for I am thy God",
      "fear not for I am with you be not dismayed"
    ]
  },
  {
    book: "Psalms", chapter: 51, verseStart: 10, verseEnd: 10,
    phrases: [
      "create in me a clean heart O God and renew a right spirit within me",
      "create in me a clean heart O God"
    ]
  },
  {
    book: "Psalms", chapter: 121, verseStart: 2, verseEnd: 2,
    phrases: [
      "my help cometh from the Lord which made heaven and earth",
      "my help comes from the Lord who made heaven and earth"
    ]
  },
  {
    book: "Proverbs", chapter: 18, verseStart: 10, verseEnd: 10,
    phrases: [
      "the name of the Lord is a strong tower the righteous runneth into it and is safe",
      "the name of the Lord is a strong tower"
    ]
  },
  {
    book: "Joshua", chapter: 24, verseStart: 15, verseEnd: 15,
    phrases: [
      "as for me and my house we will serve the Lord"
    ]
  },
  {
    book: "Matthew", chapter: 6, verseStart: 33, verseEnd: 33,
    phrases: [
      "seek ye first the kingdom of God and his righteousness and all these things shall be added",
      "seek first the kingdom of God and his righteousness"
    ]
  },
  {
    book: "Isaiah", chapter: 54, verseStart: 17, verseEnd: 17,
    phrases: [
      "no weapon that is formed against thee shall prosper",
      "no weapon formed against you shall prosper"
    ]
  },
  {
    book: "Isaiah", chapter: 53, verseStart: 5, verseEnd: 5,
    phrases: [
      "he was wounded for our transgressions he was bruised for our iniquities",
      "with his stripes we are healed",
      "by his stripes we are healed"
    ]
  },
  {
    book: "Nehemiah", chapter: 8, verseStart: 10, verseEnd: 10,
    phrases: [
      "neither be ye sorry for the joy of the Lord is your strength",
      "the joy of the Lord is your strength"
    ]
  },
  {
    book: "Psalms", chapter: 118, verseStart: 24, verseEnd: 24,
    phrases: [
      "this is the day which the Lord hath made we will rejoice and be glad in it",
      "this is the day the Lord has made we will rejoice and be glad"
    ]
  },
  {
    book: "Psalms", chapter: 46, verseStart: 10, verseEnd: 10,
    phrases: [
      "be still and know that I am God"
    ]
  },
  {
    book: "Jeremiah", chapter: 29, verseStart: 11, verseEnd: 11,
    phrases: [
      "for I know the thoughts that I think toward you saith the Lord thoughts of peace",
      "I know the plans I have for you plans to prosper you and not to harm you"
    ]
  },
  {
    book: "Psalms", chapter: 46, verseStart: 1, verseEnd: 1,
    phrases: [
      "God is our refuge and strength a very present help in trouble"
    ]
  },
  {
    book: "Proverbs", chapter: 27, verseStart: 17, verseEnd: 17,
    phrases: [
      "iron sharpeneth iron so a man sharpeneth the countenance of his friend",
      "iron sharpens iron so one man sharpens another"
    ]
  },
  {
    book: "Proverbs", chapter: 15, verseStart: 1, verseEnd: 1,
    phrases: [
      "a soft answer turneth away wrath but grievous words stir up anger",
      "a soft answer turns away wrath but a harsh word stirs up anger"
    ]
  },
  {
    book: "Galatians", chapter: 2, verseStart: 20, verseEnd: 20,
    phrases: [
      "I am crucified with Christ nevertheless I live yet not I but Christ liveth in me",
      "I am crucified with Christ it is no longer I who live"
    ]
  },
  {
    book: "John", chapter: 10, verseStart: 10, verseEnd: 10,
    phrases: [
      "the thief cometh not but for to steal and to kill and to destroy",
      "I am come that they might have life and that they might have it more abundantly",
      "I have come that they may have life and have it to the full"
    ]
  },
  {
    book: "Romans", chapter: 12, verseStart: 2, verseEnd: 2,
    phrases: [
      "be not conformed to this world but be ye transformed by the renewing of your mind",
      "do not be conformed to this world but be transformed"
    ]
  },
  {
    book: "Ephesians", chapter: 2, verseStart: 8, verseEnd: 8,
    phrases: [
      "for by grace are ye saved through faith and that not of yourselves it is the gift of God",
      "for by grace you have been saved through faith"
    ]
  },
  {
    book: "Hebrews", chapter: 11, verseStart: 1, verseEnd: 1,
    phrases: [
      "now faith is the substance of things hoped for the evidence of things not seen"
    ]
  },
  {
    book: "Romans", chapter: 8, verseStart: 31, verseEnd: 31,
    phrases: [
      "what shall we then say to these things if God be for us who can be against us",
      "if God is for us who can be against us"
    ]
  },
  {
    book: "Philippians", chapter: 4, verseStart: 6, verseEnd: 6,
    phrases: [
      "be careful for nothing but in everything by prayer and supplication",
      "do not be anxious about anything but in everything by prayer"
    ]
  }
];

// Helper to tokenize and clean text
function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "") // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 0 && !STOPWORDS.has(word));
}

// Check for matches in our local rules
export function detectLocal(text) {
  const result = {
    references: [],
    commands: [],
    sermonTopics: [],
    keyPhrases: [],
    skipGemini: false
  };

  if (!text || text.trim().length < 4) {
    return result;
  }

  const cleanText = text.trim();

  // 1. Voice Command Regex Match
  const lowerText = cleanText.toLowerCase();
  
  if (lowerText === 'next verse' || lowerText === 'next' || lowerText === 'go forward') {
    result.commands.push({ action: 'next_verse', matchedText: cleanText });
    result.skipGemini = true;
  } else if (lowerText === 'previous verse' || lowerText === 'previous' || lowerText === 'go back') {
    result.commands.push({ action: 'prev_verse', matchedText: cleanText });
    result.skipGemini = true;
  } else if (lowerText === 'next chapter') {
    result.commands.push({ action: 'next_chapter', matchedText: cleanText });
    result.skipGemini = true;
  } else if (lowerText === 'previous chapter') {
    result.commands.push({ action: 'prev_chapter', matchedText: cleanText });
    result.skipGemini = true;
  } else if (lowerText === 'clear screen' || lowerText === 'clear' || lowerText === 'hide verse' || lowerText === 'blank' || lowerText === 'blank screen') {
    result.commands.push({ action: 'clear_screen', matchedText: cleanText });
    result.skipGemini = true;
  } else if (lowerText === 'show that again' || lowerText === 'repeat' || lowerText === 'repeat verse') {
    result.commands.push({ action: 'repeat_verse', matchedText: cleanText });
    result.skipGemini = true;
  } else if (lowerText === 'fullscreen' || lowerText === 'full screen') {
    result.commands.push({ action: 'fullscreen', matchedText: cleanText });
    result.skipGemini = true;
  } else if (lowerText.includes('increase font') || lowerText.includes('larger font') || lowerText.includes('bigger font') || lowerText.includes('make text bigger')) {
    result.commands.push({ action: 'increase_font', matchedText: cleanText });
    result.skipGemini = true;
  } else if (lowerText.includes('decrease font') || lowerText.includes('smaller font') || lowerText.includes('make text smaller')) {
    result.commands.push({ action: 'decrease_font', matchedText: cleanText });
    result.skipGemini = true;
  }

  const transMatch = cleanText.match(/(?:switch to|change to|use|to|in)\s+(?:the\s+)?(KJV|NKJV|NLT|NIV|ESV|AMP|MSG|YLT|WEB)\b/i);
  if (transMatch) {
    result.commands.push({
      action: 'switch_translation',
      params: { translation: transMatch[1].toUpperCase() },
      matchedText: transMatch[0]
    });
    result.skipGemini = true;
  }

  // If a voice command was already processed and handles the whole phrase, return early.
  if (result.skipGemini && result.commands.length > 0 && cleanText.split(' ').length <= 4) {
    return result;
  }

  // 2. Regex Scripture Citation Parsing
  let refMatch;
  REFERENCE_REGEX.lastIndex = 0;
  while ((refMatch = REFERENCE_REGEX.exec(cleanText)) !== null) {
    const rawBook = refMatch[1];
    const chapter = parseInt(refMatch[2]);
    // Group 3 = verse after colon/verse/v, Group 5 = verse after plain space
    const verseRaw = refMatch[3] || refMatch[5];
    const verseEndRaw = refMatch[4] || refMatch[6];
    const verseStart = verseRaw ? parseInt(verseRaw) : 1;
    const verseEnd = verseEndRaw ? parseInt(verseEndRaw) : (verseRaw ? parseInt(verseRaw) : null);

    // Resolve book name
    const normalizedBook = rawBook.toLowerCase().replace(/[\s.]/g, '');
    let resolvedBook = BIBLE_BOOKS[rawBook];
    let bookName = rawBook;
    
    if (resolvedBook) {
      bookName = Object.keys(BIBLE_BOOKS).find(k => k.toLowerCase() === rawBook.toLowerCase()) || rawBook;
    } else if (BOOK_ABBREVIATIONS[normalizedBook]) {
      bookName = BOOK_ABBREVIATIONS[normalizedBook];
    } else {
      // Direct case-insensitive match check
      const found = Object.keys(BIBLE_BOOKS).find(k => k.toLowerCase() === normalizedBook);
      if (found) bookName = found;
      else continue; // Not a valid book
    }

    result.references.push({
      book: bookName,
      chapter: chapter,
      verseStart: verseStart,
      verseEnd: verseEnd || verseStart,
      confidence: 0.98,
      type: "exact",
      matchedText: refMatch[0],
      reasoning: "Local Regex Match"
    });
    result.skipGemini = true;
  }

  if (result.references.length > 0) {
    // Found exact regex matching citation, skip calling Gemini API
    return result;
  }

  // 3. Token-Overlap Semantic Similarity Lookup
  const textTokens = tokenize(cleanText);
  if (textTokens.length === 0) return result;

  let bestMatch = null;
  let bestScore = 0;

  for (const entry of POPULAR_VERSES) {
    for (const phrase of entry.phrases) {
      const phraseTokens = tokenize(phrase);
      if (phraseTokens.length === 0) continue;

      // Calculate intersection (overlap)
      const matches = phraseTokens.filter(token => textTokens.includes(token));
      
      // Subset Overlap Score = match count / total words in database phrase
      const overlapScore = matches.length / phraseTokens.length;

      if (overlapScore > bestScore) {
        // Confirm Contiguity Window:
        // Spoken words must be situated relatively near each other in the transcription chunk.
        const indices = matches.map(token => textTokens.indexOf(token));
        const minIdx = Math.min(...indices);
        const maxIdx = Math.max(...indices);
        const windowSize = maxIdx - minIdx + 1;

        // Allow up to 6 filler/extra words inside the matched subset window
        if (windowSize <= phraseTokens.length + 6) {
          bestScore = overlapScore;
          bestMatch = {
            book: entry.book,
            chapter: entry.chapter,
            verseStart: entry.verseStart,
            verseEnd: entry.verseEnd,
            matchedPhrase: phrase,
            score: overlapScore
          };
        }
      }
    }
  }

  // Apply matching thresholds
  if (bestMatch) {
    if (bestMatch.score >= 0.85) {
      // High Match -> Auto Project
      result.references.push({
        book: bestMatch.book,
        chapter: bestMatch.chapter,
        verseStart: bestMatch.verseStart,
        verseEnd: bestMatch.verseEnd,
        confidence: 0.92,
        type: "quote",
        matchedText: bestMatch.matchedPhrase,
        reasoning: `Local Semantic Match (phrase score: ${Math.round(bestMatch.score * 100)}%)`
      });
      result.skipGemini = true;
    } else if (bestMatch.score >= 0.65) {
      // Medium Match -> Suggestion/Review Queue
      result.references.push({
        book: bestMatch.book,
        chapter: bestMatch.chapter,
        verseStart: bestMatch.verseStart,
        verseEnd: bestMatch.verseEnd,
        confidence: 0.75,
        type: "paraphrase",
        matchedText: bestMatch.matchedPhrase,
        reasoning: `Local Semantic Suggestion (phrase score: ${Math.round(bestMatch.score * 100)}%)`
      });
      result.skipGemini = true;
    }
  }

  return result;
}
