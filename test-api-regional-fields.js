/**
 * Test API Returns Regional Fields
 * Verifies the API endpoints return the new regional/bundle fields
 */

require('dotenv').config();
const http = require('http');

async function testAPI() {
    console.log('🧪 Testing API for regional fields...\n');
    
    // Get auth token first (if needed)
    const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/product-catalogue?limit=5',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    
                    console.log('API Response Status:', res.statusCode);
                    console.log('Products returned:', response.products?.length || 0);
                    console.log('');
                    
                    if (response.products && response.products.length > 0) {
                        const firstProduct = response.products[0];
                        console.log('Sample Product Fields:');
                        console.log('  Name:', firstProduct.Name);
                        console.log('  ProductCode:', firstProduct.ProductCode);
                        console.log('  Continent__c:', firstProduct.Continent__c || 'NULL');
                        console.log('  IRP_Bundle_Region__c:', firstProduct.IRP_Bundle_Region__c || 'NULL');
                        console.log('  IRP_Bundle_Subregion__c:', firstProduct.IRP_Bundle_Subregion__c || 'NULL');
                        
                        // Check if ALM-EQ-ARG is in the list
                        const almProduct = response.products.find(p => p.ProductCode === 'ALM-EQ-ARG');
                        if (almProduct) {
                            console.log('');
                            console.log('ALM-EQ-ARG Product Found:');
                            console.log('  Continent__c:', almProduct.Continent__c);
                            console.log('  IRP_Bundle_Region__c:', almProduct.IRP_Bundle_Region__c);
                            console.log('  IRP_Bundle_Subregion__c:', almProduct.IRP_Bundle_Subregion__c);
                        }
                        
                        console.log('');
                        console.log('✅ API is returning the new regional fields!');
                    } else {
                        console.log('⚠️  No products returned from API');
                    }
                    
                    resolve();
                } catch (err) {
                    console.error('❌ Error parsing response:', err.message);
                    reject(err);
                }
            });
        });
        
        req.on('error', (err) => {
            console.error('❌ Request failed:', err.message);
            console.log('   Make sure the server is running on port 5000');
            reject(err);
        });
        
        req.end();
    });
}

testAPI()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));

