// Quick test script to verify the removals endpoint is working
const http = require('http');

const options = {
    hostname: 'localhost',
    port: process.env.PORT || 8080,
    path: '/api/provisioning/removals?timeFrame=1w',
    method: 'GET',
    headers: {
        'Accept': 'application/json'
    }
};

console.log('🧪 Testing removals endpoint...');
console.log(`📡 Connecting to http://${options.hostname}:${options.port}${options.path}`);

const req = http.request(options, (res) => {
    console.log(`✅ Status Code: ${res.statusCode}`);
    console.log(`📋 Headers:`, res.headers);
    
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log('\n📦 Response:');
        try {
            const parsed = JSON.parse(data);
            console.log(JSON.stringify(parsed, null, 2));
            console.log('\n✅ SUCCESS: Endpoint is working and returning valid JSON!');
        } catch (error) {
            console.log('❌ ERROR: Response is not valid JSON');
            console.log('Response data (first 500 chars):', data.substring(0, 500));
            console.log('\nThis suggests the endpoint may not exist or returned an HTML error page.');
            console.log('Make sure to RESTART the Node.js server after adding the new endpoint.');
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Network Error:', error.message);
    console.log('\nPossible causes:');
    console.log('1. Server is not running');
    console.log('2. Server is running on a different port');
    console.log('3. Connection was refused');
});

req.end();

