// Test creating a product update request directly
const http = require('http');

async function testCreateRequest() {
    try {
        console.log('🧪 Testing product update request creation...\n');
        
        // Test data - removing one model entitlement
        const requestData = {
            accountName: 'Test Account',
            requestedBy: 'test_user',
            priority: 'normal',
            requestType: 'modify',
            notes: 'Test request - removing one model',
            changes: {
                models: {
                    added: [],
                    removed: [{
                        productCode: 'TEST-MODEL-01',
                        productName: 'Test Model',
                        packageName: 'Test Package',
                        startDate: '2024-01-01',
                        endDate: '2025-01-01'
                    }],
                    modified: []
                },
                data: {
                    added: [],
                    removed: [],
                    modified: []
                },
                apps: {
                    added: [],
                    removed: [],
                    modified: []
                }
            }
        };
        
        console.log('📤 Sending request data:');
        console.log(JSON.stringify(requestData, null, 2));
        console.log('\n⏳ Making API call...\n');
        
        const postData = JSON.stringify(requestData);
        
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: '/api/product-update/requests',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const response = await new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve({ status: res.statusCode, data: jsonData });
                    } catch (e) {
                        resolve({ status: res.statusCode, data: data });
                    }
                });
            });
            
            req.on('error', reject);
            req.write(postData);
            req.end();
        });
        
        console.log('✅ Response received:');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));
        
        if (response.data.success) {
            console.log('\n🎉 Request created successfully!');
            console.log('Request Number:', response.data.request.requestNumber);
        } else {
            console.log('\n❌ Request failed');
            console.log('Error:', response.data.error);
        }
        
    } catch (error) {
        console.error('\n❌ Error occurred:');
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
    }
}

// Check if server is running first
async function checkServer() {
    try {
        await new Promise((resolve, reject) => {
            const req = http.get('http://localhost:3001/api/health', (res) => {
                resolve(res.statusCode === 200);
            });
            req.on('error', reject);
            req.setTimeout(2000, () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
        });
        console.log('✅ Server is running\n');
        return true;
    } catch (error) {
        console.error('❌ Server is not responding at http://localhost:3001');
        console.error('Please start the server with: npm start\n');
        return false;
    }
}

async function run() {
    const serverRunning = await checkServer();
    if (serverRunning) {
        await testCreateRequest();
    }
}

run();

