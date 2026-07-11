const http = require('http');

const data = JSON.stringify({
  riderId: 'cmrd3zi9p0001rinspt5huqhx',
  category: 'TECHNICAL',
  priority: 'MEDIUM',
  subject: 'Test Subject',
  message: 'This is a test message for the ticket'
});

const options = {
  hostname: 'localhost',
  port: 8081,
  path: '/api/support/tickets',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    // Add dummy token or we'll get 401
    // Actually, without a valid token, it will definitely return 401.
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log(`Status: ${res.statusCode}\nBody: ${body}`));
});

req.on('error', console.error);
req.write(data);
req.end();
