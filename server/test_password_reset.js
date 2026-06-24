// server/test_password_reset.js
// Automated verification script for the password reset functionality

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'data/database.json');

const email = 'test_reset@sanctiflow.com';
const oldPassword = 'OldPassword123!';
const newPassword = 'NewSecurePassword123!';

function post(path, data) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    };
    
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

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'GET'
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
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING PASSWORD RESET VERIFICATION TESTS ===\n');
  
  try {
    // 1. Create a test user if not already present, or log them in to make sure they exist
    console.log('Step 1: Making sure test user exists...');
    const signupRes = await post('/api/auth/signup', JSON.stringify({
      email,
      password: oldPassword,
      name: 'QA Password Tester',
      churchName: 'SanctiFlow QA Lab',
      role: 'operator'
    }));
    
    if (signupRes.statusCode === 201) {
      console.log('   ✅ Test user created successfully.');
    } else if (signupRes.statusCode === 400 && signupRes.data.error === 'Email already registered') {
      console.log('   ✅ Test user already exists.');
    } else {
      console.error('   ❌ Unexpected response during user signup:', signupRes.statusCode, signupRes.data);
      process.exit(1);
    }
    
    // 2. Initiate password reset request
    console.log('\nStep 2: Requesting password reset (/api/auth/forgot-password)...');
    const resetRequestRes = await post('/api/auth/forgot-password', JSON.stringify({ email }));
    console.log(`   Status Code: ${resetRequestRes.statusCode}`);
    console.log(`   Response:`, resetRequestRes.data);
    
    if (resetRequestRes.statusCode !== 200) {
      console.error('   ❌ Password reset request failed.');
      process.exit(1);
    }
    console.log('   ✅ Password reset request completed.');
    
    // 3. Read token from the database
    console.log('\nStep 3: Reading reset token from database.json...');
    if (!fs.existsSync(DB_FILE)) {
      console.error(`   ❌ Database file not found at ${DB_FILE}`);
      process.exit(1);
    }
    
    const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const tokens = dbData.resetTokens || [];
    const userTokens = tokens.filter(t => t.email === email);
    
    if (userTokens.length === 0) {
      console.error('   ❌ No reset tokens found for email:', email);
      process.exit(1);
    }
    
    // Get the latest token
    const latestTokenData = userTokens[userTokens.length - 1];
    const resetToken = latestTokenData.token;
    console.log(`   ✅ Found token: ${resetToken} (expires at: ${new Date(latestTokenData.expiresAt).toISOString()})`);
    
    // 4. Verify token
    console.log(`\nStep 4: Verifying reset token (/api/auth/reset-password/${resetToken})...`);
    const verifyTokenRes = await get(`/api/auth/reset-password/${resetToken}`);
    console.log(`   Status Code: ${verifyTokenRes.statusCode}`);
    console.log(`   Response:`, verifyTokenRes.data);
    
    if (verifyTokenRes.statusCode !== 200 || !verifyTokenRes.data.valid) {
      console.error('   ❌ Token verification failed.');
      process.exit(1);
    }
    console.log('   ✅ Reset token successfully verified.');
    
    // 5. Submit new password
    console.log('\nStep 5: Submitting new password (/api/auth/reset-password)...');
    const resetSubmitRes = await post('/api/auth/reset-password', JSON.stringify({
      token: resetToken,
      newPassword
    }));
    console.log(`   Status Code: ${resetSubmitRes.statusCode}`);
    console.log(`   Response:`, resetSubmitRes.data);
    
    if (resetSubmitRes.statusCode !== 200) {
      console.error('   ❌ Password reset submit failed.');
      process.exit(1);
    }
    console.log('   ✅ Password updated successfully.');
    
    // 6. Verify token is single-use (verifying it again should fail)
    console.log('\nStep 6: Verifying token single-use (should fail on second use)...');
    const verifyTokenAgainRes = await get(`/api/auth/reset-password/${resetToken}`);
    console.log(`   Status Code: ${verifyTokenAgainRes.statusCode} (Expected: 400)`);
    console.log(`   Response:`, verifyTokenAgainRes.data);
    
    if (verifyTokenAgainRes.statusCode === 400) {
      console.log('   ✅ Single-use verification passed. Token was deleted.');
    } else {
      console.error('   ❌ Token single-use validation failed. Token still valid!');
      process.exit(1);
    }
    
    // 7. Verify login works with new password and fails with old password
    console.log('\nStep 7: Testing login with OLD password (should fail)...');
    const loginOldRes = await post('/api/auth/login', JSON.stringify({
      email,
      password: oldPassword
    }));
    console.log(`   Status Code: ${loginOldRes.statusCode} (Expected: 401)`);
    if (loginOldRes.statusCode === 401) {
      console.log('   ✅ Login with old password blocked.');
    } else {
      console.error('   ❌ Login with old password succeeded unexpectedly!');
      process.exit(1);
    }
    
    console.log('\nStep 8: Testing login with NEW password (should succeed)...');
    const loginNewRes = await post('/api/auth/login', JSON.stringify({
      email,
      password: newPassword
    }));
    console.log(`   Status Code: ${loginNewRes.statusCode} (Expected: 200)`);
    if (loginNewRes.statusCode === 200 && loginNewRes.data.token) {
      console.log('   ✅ Login with new password succeeded. Token received.');
      console.log('\n🎉 ALL PASSWORD RESET FUNCTIONAL TESTS PASSED SUCCESSFULLY! 🎉');
    } else {
      console.error('   ❌ Login with new password failed:', loginNewRes.data);
      process.exit(1);
    }
    
  } catch (err) {
    console.error('❌ Test execution failed with error:', err);
    process.exit(1);
  }
}

// Allow server a moment if launched asynchronously, or just execute
runTests();
