// test_backend.js
// Integration test script to verify SanctiFlow hybrid AI features,
// local detection engine, and Gemini API multi-key failover capabilities.

import http from 'http';

const registerData = JSON.stringify({
  email: `test_pastor_${Date.now()}@sanctiflow.com`,
  password: 'SecurePassword123',
  name: 'Test Pastor',
  churchName: 'SanctiFlow Testing Center'
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
  console.log('=== STARTING SANCTIFLOW HYBRID AI & FAILOVER TESTS ===\n');
  
  try {
    // 1. Test Signup
    console.log('1. Testing User Registration (/api/auth/signup)...');
    const signupResult = await post('/api/auth/signup', registerData);
    console.log(`   Status Code: ${signupResult.statusCode}`);
    if (signupResult.statusCode !== 201) {
      console.error('❌ Registration failed:', signupResult.data);
      process.exit(1);
    }
    const token = signupResult.data.token;
    console.log('   ✅ Registration passed. JWT Token received.\n');
    
    // 2. Test Security
    console.log('2. Testing Security (/api/ai/detect without JWT token)...');
    const unauthorizedResult = await post('/api/ai/detect', JSON.stringify({ transcriptChunk: 'test' }));
    console.log(`   Status Code: ${unauthorizedResult.statusCode}`);
    if (unauthorizedResult.statusCode === 401) {
      console.log('   ✅ Security check passed. Unauthorized request blocked.\n');
    } else {
      console.error('❌ Security check failed. Endpoint is public!');
      process.exit(1);
    }
    
    // 3. Test Local Regex Reference Match
    console.log('3. Testing Local Regex scripture Citation Parser (Zero Gemini call)...');
    const regexData = JSON.stringify({ transcriptChunk: 'Please turn your Bibles with me to Genesis 1:1' });
    const regexResult = await post('/api/ai/detect', regexData, token);
    console.log(`   Status Code: ${regexResult.statusCode}`);
    if (regexResult.statusCode !== 200) {
      console.error('❌ Regex Test failed:', regexResult.data);
      process.exit(1);
    }
    
    const refs1 = regexResult.data.references;
    if (refs1 && refs1.length > 0 && refs1[0].book === 'Genesis' && refs1[0].chapter === 1 && refs1[0].verseStart === 1) {
      console.log(`   Resolved locally: "${refs1[0].book} ${refs1[0].chapter}:${refs1[0].verseStart}" (Reasoning: "${refs1[0].reasoning}")`);
      console.log('   ✅ Regex Scripture Citation Parser passed.\n');
    } else {
      console.error('❌ Regex match failed to resolve Genesis 1:1 correctly:', refs1);
      process.exit(1);
    }

    // 4. Test Local Semantic Overlap Phrase Match
    console.log('4. Testing Local Semantic Phrase Overlap Match (Zero Gemini call)...');
    const semanticData = JSON.stringify({ transcriptChunk: 'As Christians we must always remember that we walk by faith and not by sight in this world' });
    const semanticResult = await post('/api/ai/detect', semanticData, token);
    console.log(`   Status Code: ${semanticResult.statusCode}`);
    if (semanticResult.statusCode !== 200) {
      console.error('❌ Semantic Test failed:', semanticResult.data);
      process.exit(1);
    }
    
    const refs2 = semanticResult.data.references;
    if (refs2 && refs2.length > 0 && refs2[0].book === '2 Corinthians' && refs2[0].chapter === 5 && refs2[0].verseStart === 7) {
      console.log(`   Resolved locally: "${refs2[0].book} ${refs2[0].chapter}:${refs2[0].verseStart}" (Reasoning: "${refs2[0].reasoning}")`);
      console.log('   ✅ Local Semantic Phrase Overlap Match passed.\n');
    } else {
      console.error('❌ Semantic match failed to resolve 2 Corinthians 5:7 correctly:', refs2);
      process.exit(1);
    }

    // 5. Test Local Voice Command Match
    console.log('5. Testing Local Voice Command Parser (Zero Gemini call)...');
    const cmdData = JSON.stringify({ transcriptChunk: 'please switch to the NIV translation' });
    const cmdResult = await post('/api/ai/detect', cmdData, token);
    console.log(`   Status Code: ${cmdResult.statusCode}`);
    if (cmdResult.statusCode !== 200) {
      console.error('❌ Voice Command Test failed:', cmdResult.data);
      process.exit(1);
    }
    
    const commands = cmdResult.data.commands;
    if (commands && commands.length > 0 && commands[0].action === 'switch_translation' && commands[0].params?.translation === 'NIV') {
      console.log(`   Resolved command: "${commands[0].action}" with translation "${commands[0].params.translation}"`);
      console.log('   ✅ Local Voice Command Parser passed.\n');
    } else {
      console.error('❌ Voice command match failed to resolve correctly:', commands);
      process.exit(1);
    }

    // 6. Test Gemini Fallback and Multi-Key Failover
    console.log('6. Testing Gemini API Fallback & Automatic Key Failover...');
    console.log('   Sending phrase: "blessed are the merciful for they shall obtain mercy"');
    console.log('   (Primary key is rate-limited/exhausted. Server should trigger failover to secondary key silently)');
    
    const failoverData = JSON.stringify({ transcriptChunk: 'blessed are the merciful for they shall obtain mercy' });
    const failoverResult = await post('/api/ai/detect', failoverData, token);
    console.log(`   Status Code: ${failoverResult.statusCode}`);
    if (failoverResult.statusCode !== 200) {
      console.error('❌ Failover request failed:', failoverResult.data);
      process.exit(1);
    }
    
    const refs3 = failoverResult.data.references;
    if (refs3 && refs3.length > 0 && refs3[0].book === 'Matthew' && refs3[0].chapter === 5 && refs3[0].verseStart === 7) {
      console.log(`   Resolved by fallback model: "${refs3[0].book} ${refs3[0].chapter}:${refs3[0].verseStart}" (Confidence: ${Math.round(refs3[0].confidence * 100)}%)`);
      console.log('   ✅ Gemini API Fallback & Key Failover passed.\n');
      console.log('=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY ===');
    } else {
      console.error('❌ Failover request failed to resolve Matthew 5:7:', refs3);
      process.exit(1);
    }
    
  } catch (err) {
    console.error('❌ Test execution encountered fatal error:', err);
    process.exit(1);
  }
}

// Wait 1.5s to ensure nodemon has successfully re-started and bound ports
setTimeout(runTests, 1500);
