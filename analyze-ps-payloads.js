/**
 * Analyze PS Record JSON Payloads
 * 
 * This script analyzes all PS record payloads from the ps_audit_trail table
 * and creates an Excel spreadsheet showing all unique values for each attribute.
 */

require('dotenv').config();
const database = require('./database');
const XLSX = require('xlsx');

async function analyzePSPayloads() {
    console.log('🔍 Starting PS Payload Analysis...');
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log('');
    
    try {
        // Query all PS records from the audit trail
        console.log('📊 Querying all PS records from database...');
        
        const query = `
            SELECT 
                ps_record_id,
                ps_record_name,
                payload_data,
                created_date,
                captured_at
            FROM ps_audit_trail
            WHERE payload_data IS NOT NULL
            ORDER BY created_date DESC
        `;
        
        const result = await database.query(query, []);
        const records = result.rows || [];
        
        console.log(`✅ Retrieved ${records.length} PS records with payload data`);
        console.log('');
        
        if (records.length === 0) {
            console.log('⚠️  No records found with payload data. Exiting.');
            await database.closePool();
            process.exit(0);
        }
        
        // Analyze all payloads to extract attributes and their unique values
        console.log('🔬 Analyzing payload structures...');
        
        const attributeMap = new Map(); // Map<attribute, Set<unique_values>>
        let successfullyParsed = 0;
        let failedToParse = 0;
        
        for (const record of records) {
            try {
                let payload;
                
                // Parse payload data if it's a string
                if (typeof record.payload_data === 'string') {
                    try {
                        payload = JSON.parse(record.payload_data);
                    } catch (parseError) {
                        // If it fails to parse, it might be a plain string
                        failedToParse++;
                        continue;
                    }
                } else {
                    payload = record.payload_data;
                }
                
                // Skip if payload is null, undefined, or not an object
                if (!payload || typeof payload !== 'object') {
                    failedToParse++;
                    continue;
                }
                
                // Recursively extract all attributes and values
                extractAttributes(payload, attributeMap, '');
                
                successfullyParsed++;
                
            } catch (error) {
                failedToParse++;
                console.error(`   ⚠️  Error parsing record ${record.ps_record_name}: ${error.message}`);
            }
        }
        
        console.log(`✅ Successfully analyzed ${successfullyParsed} payloads`);
        if (failedToParse > 0) {
            console.log(`   ⚠️  Failed to parse ${failedToParse} payloads`);
        }
        console.log('');
        
        // Convert the attribute map to Excel format
        console.log('📝 Preparing Excel data...');
        console.log(`   Total unique attributes found: ${attributeMap.size}`);
        console.log('');
        
        // Create workbook
        const workbook = XLSX.utils.book_new();
        
        // Create main summary worksheet
        const summaryData = [];
        summaryData.push(['PS Record Payload Analysis']);
        summaryData.push(['Generated:', new Date().toISOString()]);
        summaryData.push(['Total Records Analyzed:', successfullyParsed]);
        summaryData.push(['Total Unique Attributes:', attributeMap.size]);
        summaryData.push([]);
        summaryData.push(['Attribute', 'Unique Values Count', 'Sample Values (first 5)']);
        
        // Sort attributes alphabetically
        const sortedAttributes = Array.from(attributeMap.keys()).sort();
        
        for (const attribute of sortedAttributes) {
            const values = Array.from(attributeMap.get(attribute));
            const sampleValues = values.slice(0, 5).join(', ');
            summaryData.push([attribute, values.length, sampleValues]);
        }
        
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
        
        // Create detailed attribute sheets (split into chunks if too many attributes)
        const maxAttributesPerSheet = 100;
        let sheetIndex = 1;
        
        for (let i = 0; i < sortedAttributes.length; i += maxAttributesPerSheet) {
            const attributeChunk = sortedAttributes.slice(i, i + maxAttributesPerSheet);
            
            // Find the maximum number of unique values in this chunk
            let maxRows = 0;
            for (const attr of attributeChunk) {
                const valueCount = attributeMap.get(attr).size;
                if (valueCount > maxRows) {
                    maxRows = valueCount;
                }
            }
            
            // Create 2D array for this sheet
            const sheetData = [];
            
            // Header row (attribute names)
            sheetData.push(attributeChunk);
            
            // Data rows (unique values for each attribute)
            for (let row = 0; row < maxRows; row++) {
                const rowData = [];
                for (const attr of attributeChunk) {
                    const values = Array.from(attributeMap.get(attr));
                    rowData.push(values[row] !== undefined ? values[row] : '');
                }
                sheetData.push(rowData);
            }
            
            const detailSheet = XLSX.utils.aoa_to_sheet(sheetData);
            
            // Set column widths
            const columnWidths = attributeChunk.map(() => ({ wch: 30 }));
            detailSheet['!cols'] = columnWidths;
            
            const sheetName = sheetIndex === 1 && attributeChunk.length <= maxAttributesPerSheet
                ? 'All Attributes'
                : `Attributes ${i + 1}-${Math.min(i + maxAttributesPerSheet, sortedAttributes.length)}`;
            
            XLSX.utils.book_append_sheet(workbook, detailSheet, sheetName);
            sheetIndex++;
        }
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const filename = `PS_Payload_Analysis_${timestamp}.xlsx`;
        
        // Write Excel file
        console.log(`💾 Writing Excel file: ${filename}`);
        XLSX.writeFile(workbook, filename);
        
        console.log('');
        console.log('✅ Analysis complete!');
        console.log(`📄 Excel file created: ${filename}`);
        console.log('');
        console.log('📊 Summary:');
        console.log(`   Total PS Records: ${records.length}`);
        console.log(`   Successfully Analyzed: ${successfullyParsed}`);
        console.log(`   Total Unique Attributes: ${attributeMap.size}`);
        console.log('');
        
        // Show top 20 attributes with most unique values
        console.log('📋 Top 20 Attributes by Unique Value Count:');
        const sortedByValueCount = Array.from(attributeMap.entries())
            .sort((a, b) => b[1].size - a[1].size)
            .slice(0, 20);
        
        for (const [attr, values] of sortedByValueCount) {
            console.log(`   ${attr.padEnd(50)} : ${values.size} unique values`);
        }
        
        // Close database connection
        await database.closePool();
        
    } catch (error) {
        console.error('❌ Error during analysis:', error);
        await database.closePool();
        process.exit(1);
    }
}

/**
 * Recursively extract all attributes and values from a payload object
 * @param {Object} obj - The object to extract from
 * @param {Map} attributeMap - Map to store attributes and their unique values
 * @param {string} prefix - Prefix for nested attributes
 */
function extractAttributes(obj, attributeMap, prefix) {
    if (!obj || typeof obj !== 'object') {
        return;
    }
    
    // Handle arrays
    if (Array.isArray(obj)) {
        // For arrays, we'll process each item but not create separate attributes for indices
        obj.forEach((item, index) => {
            if (item && typeof item === 'object') {
                // For array items that are objects, use array notation
                extractAttributes(item, attributeMap, `${prefix}[${index}]`);
            } else {
                // For primitive array items, store under the array name itself
                const key = prefix || 'array';
                if (!attributeMap.has(key)) {
                    attributeMap.set(key, new Set());
                }
                attributeMap.get(key).add(String(item));
            }
        });
        return;
    }
    
    // Handle objects
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (value === null) {
            // Store null values
            if (!attributeMap.has(fullKey)) {
                attributeMap.set(fullKey, new Set());
            }
            attributeMap.get(fullKey).add('null');
        } else if (value === undefined) {
            // Store undefined values
            if (!attributeMap.has(fullKey)) {
                attributeMap.set(fullKey, new Set());
            }
            attributeMap.get(fullKey).add('undefined');
        } else if (typeof value === 'object') {
            // Recursively process nested objects/arrays
            extractAttributes(value, attributeMap, fullKey);
        } else {
            // Store primitive values (string, number, boolean)
            if (!attributeMap.has(fullKey)) {
                attributeMap.set(fullKey, new Set());
            }
            
            // Convert value to string for storage
            let stringValue;
            if (typeof value === 'boolean') {
                stringValue = value ? 'true' : 'false';
            } else if (typeof value === 'number') {
                stringValue = String(value);
            } else {
                stringValue = String(value);
            }
            
            attributeMap.get(fullKey).add(stringValue);
        }
    }
}

// Run the analysis
if (require.main === module) {
    analyzePSPayloads().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = {
    analyzePSPayloads
};

