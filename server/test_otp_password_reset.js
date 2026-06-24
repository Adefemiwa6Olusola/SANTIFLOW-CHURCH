// server/test_otp_password_reset.js
// Automated verification script for OTP-based password reset flow

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OTP_TEST_FILE = path.join(__dirname, 'data/last_otp_test.json');

const email = 'test_otp@sanctiflow.com';
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

async function runTests() {
  console.log('=== STARTING OTP PASSWORD RESET VERIFICATION TESTS ===\n');
  
  try {
    // 1. Ensure test user exists
    console.log('Step 1: Making sure test user exists...');
    const signupRes = await post('/api/auth/signup', JSON.stringify({
      email,
      password: oldPassword,
      name: 'QA OTP Tester',
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
    
    // 2. Initiate OTP request
    console.log('\nStep 2: Requesting OTP verification code (/api/auth/forgot-password)...');
    const resetRequestRes = await post('/api/auth/forgot-password', JSON.stringify({ email }));
    console.log(`   Status Code: ${resetRequestRes.statusCode}`);
    console.log(`   Response:`, resetRequestRes.data);
    
    if (resetRequestRes.statusCode !== 200) {
      console.error('   ❌ OTP request failed.');
      process.exit(1);
    }
    console.log('   ✅ OTP code successfully requested.');
    
    // 3. Read generated OTP from mock file
    console.log('\nStep 3: Reading generated OTP from last_otp_test.json...');
    if (!fs.existsSync(OTP_TEST_FILE)) {
      console.error(`   ❌ OTP test mock file not found at ${OTP_TEST_FILE}`);
      process.exit(1);
    }
    
    const otpMockData = JSON.parse(fs.readFileSync(OTP_TEST_FILE, 'utf8'));
    if (otpMockData.email !== email) {
      console.error(`   ❌ Found mock OTP but for wrong email: ${otpMockData.email}`);
      process.exit(1);
    }
    
    const otpCode = otpMockData.otp;
    console.log(`   ✅ Found active OTP code: ${otpCode}`);
    
    // 4. Verify WRONG OTP fails
    console.log('\nStep 4: Verifying WRONG OTP fails (/api/auth/verify-otp)...');
    const verifyWrongRes = await post('/api/auth/verify-otp', JSON.stringify({
      email,
      otp: '999999' // wrong code
    }));
    console.log(`   Status Code: ${verifyWrongRes.statusCode} (Expected: 400)`);
    console.log(`   Response:`, verifyWrongRes.data);
    
    if (verifyWrongRes.statusCode !== 400) {
      console.error('   ❌ Security validation error: Wrong OTP accepted!');
      process.exit(1);
    }
    console.log('   ✅ Wrong OTP validation correctly blocked.');
    
    // 5. Verify correct OTP succeeds
    console.log('\nStep 5: Verifying CORRECT OTP succeeds (/api/auth/verify-otp)...');
    const verifyCorrectRes = await post('/api/auth/verify-otp', JSON.stringify({
      email,
      otp: otpCode
    }));
    console.log(`   Status Code: ${verifyCorrectRes.statusCode} (Expected: 200)`);
    console.log(`   Response:`, verifyCorrectRes.data);
    
    if (verifyCorrectRes.statusCode !== 200) {
      console.error('   ❌ OTP verification failed for valid code.');
      process.exit(1);
    }
    console.log('   ✅ Correct OTP successfully verified.');
    
    // 6. Reset password using the verified details
    console.log('\nStep 6: Resetting password using the verified code (/api/auth/reset-password)...');
    const resetSubmitRes = await post('/api/auth/reset-password', JSON.stringify({
      email,
      otp: otpCode,
      newPassword
    }));
    console.log(`   Status Code: ${resetSubmitRes.statusCode}`);
    console.log(`   Response:`, resetSubmitRes.data);
    
    if (resetSubmitRes.statusCode !== 200) {
      console.error('   ❌ Password reset execution failed.');
      process.exit(1);
    }
    console.log('   ✅ Password updated successfully.');
    
    // 7. Verify OTP is single-use (resetting again with same OTP should fail)
    console.log('\nStep 7: Verifying OTP single-use (resetting again with same code should fail)...');
    const resetAgainRes = await post('/api/auth/reset-password', JSON.stringify({
      email,
      otp: otpCode,
      newPassword
    }));
    console.log(`   Status Code: ${resetAgainRes.statusCode} (Expected: 400)`);
    console.log(`   Response:`, resetAgainRes.data);
    
    if (resetAgainRes.statusCode === 400) {
      console.log('   ✅ Single-use verification passed. OTP record was deleted.');
    } else {
      console.error('   ❌ Validation error: OTP was not invalidated after use!');
      process.exit(1);
    }
    
    // 8. Verify login works with new password and fails with old password
    console.log('\nStep 8: Testing login with OLD password (should fail)...');
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
    
    console.log('\nStep 9: Testing login with NEW password (should succeed)...');
    const loginNewRes = await post('/api/auth/login', JSON.stringify({
      email,
      password: newPassword
    }));
    console.log(`   Status Code: ${loginNewRes.statusCode} (Expected: 200)`);
    if (loginNewRes.statusCode === 200 && loginNewRes.data.token) {
      console.log('   ✅ Login with new password succeeded. Token received.');
      console.log('\n🎉 ALL OTP PASSWORD RESET TESTS PASSED SUCCESSFULLY! 🎉');
      process.exit(0);
    } else {
      console.error('   ❌ Login with new password failed:', loginNewRes.data);
      process.exit(1);
    }
    
  } catch (err) {
    console.error('❌ Test execution failed with error:', err);
    process.exit(1);
  }
}

runTests();
