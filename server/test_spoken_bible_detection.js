// server/test_spoken_bible_detection.js
// Integration test to verify spoken and numerical Bible references detection
// and the popular verses semantic phrase detection engine.

import http from 'http';

const registerData = JSON.stringify({
  email: `test_preacher_${Date.now()}@sanctiflow.com`,
  password: 'Password123!',
  name: 'Preacher Test',
  churchName: 'SanctiFlow Chapel'
});

// Helper for POST requests
function post(path, data, token = null) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'POST',
      headers: headers
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ statusCode: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING SANCTIFLOW SPOKEN BIBLE DETECTION TESTS ===\n');
  
  try {
    // 1. Register a test user
    console.log('1. Registering test preacher user...');
    const signupResult = await post('/api/auth/signup', registerData);
    if (signupResult.statusCode !== 201) {
      console.error('❌ Registration failed:', signupResult.data);
      process.exit(1);
    }
    const token = signupResult.data.token;
    console.log('   ✅ Registration successful. Token received.\n');
    
    // Test cases
    const testCases = [
      {
        input: 'Please turn to Gen 5:6 in your Bibles',
        expected: { book: 'Genesis', chapter: 5, verseStart: 6, type: 'exact' }
      },
      {
        input: 'We read from Genesis chapter five verse six',
        expected: { book: 'Genesis', chapter: 5, verseStart: 6, type: 'exact' }
      },
      {
        input: 'Let us look at First John chapter four verse four',
        expected: { book: '1 John', chapter: 4, verseStart: 4, type: 'exact' }
      },
      {
        input: 'Open your bible to Romans chapter eight verse twenty-eight',
        expected: { book: 'Romans', chapter: 8, verseStart: 28, type: 'exact' }
      },
      {
        input: 'For the Bible says that the lord is good all the time and his mercy is everlasting',
        expected: { book: 'Psalms', chapter: 100, verseStart: 5, type: 'quote' }
      }
    ];

    let passedCount = 0;

    for (let index = 0; index < testCases.length; index++) {
      const tc = testCases[index];
      console.log(`Test Case ${index + 1}: Analyzing "${tc.input}"`);
      
      const payload = JSON.stringify({ transcriptChunk: tc.input });
      const result = await post('/api/ai/detect', payload, token);
      
      if (result.statusCode !== 200) {
        console.error(`   ❌ Failed with status code ${result.statusCode}:`, result.data);
        continue;
      }

      const refs = result.data.references;
      if (!refs || refs.length === 0) {
        console.error(`   ❌ No references detected for "${tc.input}"`);
        continue;
      }

      const matchedRef = refs[0];
      console.log(`   Detected: ${matchedRef.book} ${matchedRef.chapter}:${matchedRef.verseStart} (Type: ${matchedRef.type}, Confidence: ${matchedRef.confidence})`);
      
      const matchesBook = matchedRef.book === tc.expected.book;
      const matchesChapter = matchedRef.chapter === tc.expected.chapter;
      const matchesVerse = matchedRef.verseStart === tc.expected.verseStart;
      const matchesType = matchedRef.type === tc.expected.type;

      if (matchesBook && matchesChapter && matchesVerse && matchesType) {
        console.log('   ✅ Match matches expectation perfectly.\n');
        passedCount++;
      } else {
        console.error(`   ❌ Verification failed: Expected ${tc.expected.book} ${tc.expected.chapter}:${tc.expected.verseStart} (Type: ${tc.expected.type}) but got ${matchedRef.book} ${matchedRef.chapter}:${matchedRef.verseStart} (Type: ${matchedRef.type})\n`);
      }
    }

    console.log(`=== TEST SUMMARY: Passed ${passedCount}/${testCases.length} ===`);
    if (passedCount === testCases.length) {
      console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
      process.exit(0);
    } else {
      console.error('❌ SOME TESTS FAILED. Please review the output.');
      process.exit(1);
    }

  } catch (err) {
    console.error('❌ Execution error running integration tests:', err);
    process.exit(1);
  }
}

runTests();
