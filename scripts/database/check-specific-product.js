/**
 * Check Specific Product in Salesforce
 */

require('dotenv').config();
const salesforce = require('./salesforce');

async function checkProduct() {
    try {
        console.log('Checking ALM-EQ-ARG in Salesforce...\n');
        
        const conn = await salesforce.getConnection();
        
        const result = await conn.query(`
            SELECT Id, Name, ProductCode, Continent__c, IRP_Bundle_Region__c, IRP_Bundle_Subregion__c,
                   LastModifiedDate
            FROM Product2
            WHERE ProductCode = 'ALM-EQ-ARG'
            LIMIT 1
        `);
        
        if (result.records.length > 0) {
            const product = result.records[0];
            console.log('Salesforce Product:');
            console.log(`  Id: ${product.Id}`);
            console.log(`  Name: ${product.Name}`);
            console.log(`  ProductCode: ${product.ProductCode}`);
            console.log(`  Continent__c: ${product.Continent__c}`);
            console.log(`  IRP_Bundle_Region__c: ${product.IRP_Bundle_Region__c}`);
            console.log(`  IRP_Bundle_Subregion__c: ${product.IRP_Bundle_Subregion__c}`);
            console.log(`  LastModifiedDate: ${product.LastModifiedDate}`);
        } else {
            console.log('Product not found in Salesforce!');
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

checkProduct();

