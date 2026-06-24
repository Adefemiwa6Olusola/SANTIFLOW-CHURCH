// scratch/test_num_parser.js

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

const tests = [
  "Genesis chapter five verse six",
  "Romans chapter eight verse twenty-eight",
  "First John chapter four verse four",
  "Gen 5:6",
  "Revelation chapter twenty two verse twenty one",
  "one hundred and nineteen",
  "the lord is good all the time",
  "Psalm twenty-three verse one"
];

tests.forEach(t => {
  console.log(`Original: "${t}" -> Normalized: "${convertNumberWordsToDigits(t)}"`);
});
