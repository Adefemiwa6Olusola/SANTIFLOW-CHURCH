import http from 'http';

http.get('http://localhost:5173/', (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(`HTML LENGTH: ${body.length}`);
    console.log(`HTML CONTENT: ${body}`);
  });
}).on('error', (e) => {
  console.error(`ERROR: ${e.message}`);
});
