import https from 'https';

const data = JSON.stringify({
  email: 'test_otp@sanctiflow.com',
  password: 'NewSecurePassword123!'
});

const options = {
  hostname: 'sanctiflow-backend.onrender.com',
  port: 443,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => {
    console.log(`RESPONSE: ${body}`);
  });
});

req.on('error', (e) => {
  console.error(`ERROR: ${e.message}`);
});

req.write(data);
req.end();
