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
    book: "Psalms", chapter: 100, verseStart: 5, verseEnd: 5,
    phrases: [
      "the lord is good",
      "for the lord is good his mercy is everlasting",
      "the lord is good all the time",
      "all the time the lord is good"
    ]
  },
  {
    book: "Psalms", chapter: 34, verseStart: 8, verseEnd: 8,
    phrases: [
      "taste and see that the lord is good",
      "o taste and see that the lord is good"
    ]
  },
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
  },
  // ── Beatitudes (Matthew 5) ──
  {
    book: "Matthew", chapter: 5, verseStart: 3, verseEnd: 3,
    phrases: [
      "blessed are the poor in spirit for theirs is the kingdom of heaven",
      "blessed are the poor in spirit"
    ]
  },
  {
    book: "Matthew", chapter: 5, verseStart: 4, verseEnd: 4,
    phrases: [
      "blessed are they that mourn for they shall be comforted",
      "blessed are those who mourn for they shall be comforted"
    ]
  },
  {
    book: "Matthew", chapter: 5, verseStart: 5, verseEnd: 5,
    phrases: [
      "blessed are the meek for they shall inherit the earth",
      "blessed are the meek"
    ]
  },
  {
    book: "Matthew", chapter: 5, verseStart: 7, verseEnd: 7,
    phrases: [
      "blessed are the merciful for they shall obtain mercy",
      "blessed are the merciful"
    ]
  },
  {
    book: "Matthew", chapter: 5, verseStart: 9, verseEnd: 9,
    phrases: [
      "blessed are the peacemakers for they shall be called the children of God",
      "blessed are the peacemakers"
    ]
  },
  // ── Additional high-frequency verses ──
  {
    book: "Jeremiah", chapter: 29, verseStart: 11, verseEnd: 11,
    phrases: [
      "for I know the thoughts that I think toward you saith the Lord thoughts of peace and not of evil",
      "I know the plans I have for you plans to prosper you and not to harm you plans for a hope and a future",
      "God has plans for us plans for a future and a hope",
      "plans to give you a hope and a future"
    ]
  },
  {
    book: "John", chapter: 3, verseStart: 17, verseEnd: 17,
    phrases: [
      "for God sent not his son into the world to condemn the world but that the world through him might be saved",
      "God sent his son not to condemn the world but to save the world"
    ]
  },
  {
    book: "Romans", chapter: 10, verseStart: 9, verseEnd: 9,
    phrases: [
      "if thou shalt confess with thy mouth the Lord Jesus and shalt believe in thine heart that God hath raised him",
      "if you confess with your mouth that Jesus is Lord and believe in your heart",
      "confess with your mouth the Lord Jesus"
    ]
  },
  {
    book: "Psalms", chapter: 27, verseStart: 1, verseEnd: 1,
    phrases: [
      "the Lord is my light and my salvation whom shall I fear the Lord is the strength of my life",
      "the Lord is my light and my salvation whom shall I fear"
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

// Helper to convert spoken number words and ordinals into digit strings
function convertNumberWordsToDigits(text) {
  if (!text) return "";
  
  let result = text;
  
  // 1. Ordinal book name handling (e.g. "First John" -> "1 John", "2nd Kings" -> "2 Kings")
  const ordinalBooksPattern = /\b(first|1st|second|2nd|third|3rd)\s+(john|peter|samuel|kings|chronicles|corinthians|thessalonians|timothy)\b/gi;
  result = result.replace(ordinalBooksPattern, (match, ord, book) => {
    let num = '1';
    const lowerOrd = ord.toLowerCase();
    if (lowerOrd === 'second' || lowerOrd === '2nd') num = '2';
    if (lowerOrd === 'third' || lowerOrd === '3rd') num = '3';
    return `${num} ${book}`;
  });

  // Also handle "1st", "2nd", "3rd" prefixing standard books if typed together, e.g. "1stJohn" -> "1 John"
  result = result.replace(/\b(1st|2nd|3rd|first|second|third)(john|peter|samuel|kings|chronicles|corinthians|thessalonians|timothy)\b/gi, (match, ord, book) => {
    let num = '1';
    const lowerOrd = ord.toLowerCase();
    if (lowerOrd === 'second' || lowerOrd === '2nd') num = '2';
    if (lowerOrd === 'third' || lowerOrd === '3rd') num = '3';
    return `${num} ${book}`;
  });

  // 2. Map word numbers to digits. Let's do this sequentially for multi-word numbers
  const ones = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
    'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19
  };
  const tens = {
    'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90
  };
  const ordinals = {
    'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5, 'sixth': 6, 'seventh': 7, 'eighth': 8, 'ninth': 9, 'nineth': 9,
    'tenth': 10, 'eleventh': 11, 'twelfth': 12, 'thirteenth': 13, 'fourteenth': 14, 'fifteenth': 15,
    'sixteenth': 16, 'seventeenth': 17, 'eighteenth': 18, 'nineteenth': 19, 'twentieth': 20,
    'thirtieth': 30, 'fortieth': 40, 'fiftieth': 50, 'sixtieth': 60, 'seventieth': 70, 'eightieth': 80, 'ninetieth': 90
  };

  const numWordsList = [
    'hundred', 'and',
    ...Object.keys(ones),
    ...Object.keys(tens),
    ...Object.keys(ordinals)
  ];
  
  result = result.replace(/-/g, ' ');

  const tokens = result.split(/(\s+)/); // keep whitespace
  let i = 0;
  let newTokens = [];
  
  while (i < tokens.length) {
    const token = tokens[i];
    const cleanToken = token.trim().toLowerCase();
    
    if (cleanToken && numWordsList.includes(cleanToken)) {
      let seq = [cleanToken];
      let j = i + 1;
      let lastValidNumWordIndex = i;
      
      while (j < tokens.length) {
        const nextToken = tokens[j];
        const nextClean = nextToken.trim().toLowerCase();
        
        if (!nextClean) {
          j++;
          continue;
        }
        
        if (numWordsList.includes(nextClean)) {
          seq.push(nextClean);
          lastValidNumWordIndex = j;
          j++;
        } else {
          break;
        }
      }
      
      const seqStr = seq.join(' ');
      if (seqStr === 'and' || seqStr === 'a') {
        for (let k = i; k <= lastValidNumWordIndex; k++) {
          newTokens.push(tokens[k]);
        }
      } else {
        const numValue = parseNumberSequence(seq);
        if (numValue !== null) {
          newTokens.push(numValue.toString());
        } else {
          for (let k = i; k <= lastValidNumWordIndex; k++) {
            newTokens.push(tokens[k]);
          }
        }
      }
      
      i = lastValidNumWordIndex + 1;
    } else {
      newTokens.push(token);
      i++;
    }
  }
  
  return newTokens.join('');
}

function parseNumberSequence(words) {
  let total = 0;
  let current = 0;
  
  const ones = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
    'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19
  };
  const tens = {
    'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90
  };
  const ordinals = {
    'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5, 'sixth': 6, 'seventh': 7, 'eighth': 8, 'ninth': 9, 'nineth': 9,
    'tenth': 10, 'eleventh': 11, 'twelfth': 12, 'thirteenth': 13, 'fourteenth': 14, 'fifteenth': 15,
    'sixteenth': 16, 'seventeenth': 17, 'eighteenth': 18, 'nineteenth': 19, 'twentieth': 20,
    'thirtieth': 30, 'fortieth': 40, 'fiftieth': 50, 'sixtieth': 60, 'seventieth': 70, 'eightieth': 80, 'ninetieth': 90
  };

  for (const word of words) {
    if (ones[word] !== undefined) {
      current += ones[word];
    } else if (ordinals[word] !== undefined) {
      current += ordinals[word];
    } else if (tens[word] !== undefined) {
      current += tens[word];
    } else if (word === 'hundred') {
      current = (current === 0 ? 1 : current) * 100;
    } else if (word === 'thousand') {
      current = (current === 0 ? 1 : current) * 1000;
      total += current;
      current = 0;
    } else if (word === 'and') {
      // skip
    } else {
      return null;
    }
  }
  
  return total + current;
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

  // Normalize spoken numbers and book ordinals to digits
  const normalizedText = convertNumberWordsToDigits(text);
  const cleanText = normalizedText.trim();

  // 1. Voice Command Regex Match
  const lowerText = cleanText.toLowerCase();
  
  if (lowerText === 'next verse' || lowerText === 'go forward') {
    result.commands.push({ action: 'next_verse', matchedText: cleanText });
    result.skipGemini = true;
  } else if (lowerText === 'previous verse' || lowerText === 'go back') {
    result.commands.push({ action: 'prev_verse', matchedText: cleanText });
    result.skipGemini = true;
  } else if (lowerText === 'next chapter') {
    result.commands.push({ action: 'next_chapter', matchedText: cleanText });
    result.skipGemini = true;
  } else if (lowerText === 'previous chapter') {
    result.commands.push({ action: 'prev_chapter', matchedText: cleanText });
    result.skipGemini = true;
  } else if (lowerText === 'clear screen' || lowerText === 'hide verse' || lowerText === 'blank screen') {
    result.commands.push({ action: 'clear_screen', matchedText: cleanText });
    result.skipGemini = true;
  } else if (lowerText === 'show that again' || lowerText === 'repeat verse') {
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

        // Allow up to 10 filler/extra words inside the matched subset window
        if (windowSize <= phraseTokens.length + 10) {
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

  // Apply matching thresholds (optimized for increased sensitivity)
  if (bestMatch) {
    if (bestMatch.score >= 0.70) {
      // High Match -> Auto Project
      result.references.push({
        book: bestMatch.book,
        chapter: bestMatch.chapter,
        verseStart: bestMatch.verseStart,
        verseEnd: bestMatch.verseEnd,
        confidence: 0.90,
        type: "quote",
        matchedText: bestMatch.matchedPhrase,
        reasoning: `Local Semantic Match (phrase score: ${Math.round(bestMatch.score * 100)}%)`
      });
      result.skipGemini = true;
    } else if (bestMatch.score >= 0.50) {
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

  // 4. Voice command to project a specific verse when explicit command keywords are detected
  const hasDisplayKeyword = /\b(show|project|display)\b/i.test(cleanText);
  if (hasDisplayKeyword && result.references.length > 0) {
    const ref = result.references[0];
    result.commands.push({
      action: 'project_specific_verse',
      params: {
        book: ref.book,
        chapter: ref.chapter,
        verseStart: ref.verseStart,
        verseEnd: ref.verseEnd
      },
      matchedText: cleanText
    });
    result.skipGemini = true;
  }

  return result;
}
