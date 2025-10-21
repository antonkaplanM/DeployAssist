/**
 * Port Testing Script
 * Tests multiple ports to find which ones work with firewall/VPN
 */

const http = require('http');

// Ports to test (commonly unblocked development ports)
const portsToTest = [
  { port: 5000, name: 'Common Node.js port' },
  { port: 4000, name: 'Alternative dev port' },
  { port: 8000, name: 'Alternative HTTP port' },
  { port: 8888, name: 'Common proxy port' },
  { port: 3001, name: 'Alternative to 3000' },
  { port: 9000, name: 'Common dev port' },
  { port: 7000, name: 'Another alternative' },
  { port: 5500, name: 'Live Server default' },
];

console.log('\n🔍 Testing ports for firewall/VPN compatibility...\n');
console.log('This will try to start a simple HTTP server on each port.');
console.log('If successful, you can visit http://localhost:PORT in your browser.\n');

let currentIndex = 0;

function testNextPort() {
  if (currentIndex >= portsToTest.length) {
    console.log('\n✅ Testing complete!');
    console.log('\nNext steps:');
    console.log('1. Try accessing the ports marked as ✅ WORKS in your browser');
    console.log('2. Choose a port that works for the old app comparison\n');
    process.exit(0);
    return;
  }

  const { port, name } = portsToTest[currentIndex];
  
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Port ${port} Test</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            backdrop-filter: blur(10px);
          }
          h1 { font-size: 48px; margin: 0 0 20px 0; }
          p { font-size: 20px; margin: 10px 0; }
          .success { color: #4ade80; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ Port ${port} Works!</h1>
          <p class="success">${name}</p>
          <p>This port is accessible through your firewall/VPN</p>
          <p style="margin-top: 30px; font-size: 14px; opacity: 0.8;">
            Test started at ${new Date().toLocaleTimeString()}
          </p>
        </div>
      </body>
      </html>
    `);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`❌ Port ${port} (${name}): Already in use`);
    } else {
      console.log(`❌ Port ${port} (${name}): Error - ${err.message}`);
    }
    currentIndex++;
    testNextPort();
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`✅ Port ${port} (${name}): Server started successfully!`);
    console.log(`   👉 Test in browser: http://localhost:${port}`);
    console.log(`   Press Ctrl+C when ready to test the next port\n`);
  });
}

// Handle Ctrl+C to move to next port
process.on('SIGINT', () => {
  console.log('\n⏭️  Moving to next port...\n');
  currentIndex++;
  testNextPort();
});

// Start testing
testNextPort();



