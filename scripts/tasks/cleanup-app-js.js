#!/usr/bin/env node

/**
 * App.js Cleanup Script
 * 
 * This script removes extracted route sections from app.js
 * and creates a backup before making changes.
 * 
 * Usage: node scripts/tasks/cleanup-app-js.js
 */

const fs = require('fs');
const path = require('path');

// File paths
const APP_JS_PATH = path.join(__dirname, '..', '..', 'app.js');
const BACKUP_PATH = path.join(__dirname, '..', '..', 'app.js.backup');

// Section markers to remove (START marker -> END marker)
const SECTIONS_TO_REMOVE = [
    {
        name: 'Salesforce API',
        start: '// ===== SALESFORCE API ENDPOINTS =====',
        end: '// ===== VALIDATION ERRORS API =====',
        keepEndMarker: true
    },
    {
        name: 'Validation Errors',
        start: '// ===== VALIDATION ERRORS API =====',
        end: '// ===== ASYNC VALIDATION RESULTS API =====',
        keepEndMarker: false
    },
    {
        name: 'Async Validation Results',
        start: '// ===== ASYNC VALIDATION RESULTS API =====',
        end: '// ===== EXPIRATION MONITOR API ENDPOINTS =====',
        keepEndMarker: true
    },
    {
        name: 'Expiration Monitor',
        start: '// ===== EXPIRATION MONITOR API ENDPOINTS =====',
        end: '// ===== PACKAGE CHANGE ANALYSIS API ENDPOINTS =====',
        keepEndMarker: true
    },
    {
        name: 'Package Change Analysis',
        start: '// ===== PACKAGE CHANGE ANALYSIS API ENDPOINTS =====',
        end: '// ===== GHOST ACCOUNTS API ENDPOINTS =====',
        keepEndMarker: true
    },
    {
        name: 'Ghost Accounts',
        start: '// ===== GHOST ACCOUNTS API ENDPOINTS =====',
        end: '// ===== SML GHOST ACCOUNTS API ENDPOINTS =====',
        keepEndMarker: true
    },
    // SKIP SML GHOST ACCOUNTS - it's a separate system
    {
        name: 'Customer Products',
        start: '// ===== CUSTOMER PRODUCTS API ENDPOINTS =====',
        end: '// ===== PRODUCT UPDATE WORKFLOW ENDPOINTS =====',
        keepEndMarker: true
    },
    {
        name: 'Product Update Workflow',
        start: '// ===== PRODUCT UPDATE WORKFLOW ENDPOINTS =====',
        end: '// ===== PACKAGE ENDPOINTS =====',
        keepEndMarker: true
    },
    {
        name: 'Package Endpoints',
        start: '// ===== PACKAGE ENDPOINTS =====',
        end: '// ===== PACKAGE-PRODUCT MAPPING API ENDPOINTS =====',
        keepEndMarker: true
    },
    {
        name: 'Package-Product Mapping',
        start: '// ===== PACKAGE-PRODUCT MAPPING API ENDPOINTS =====',
        end: '// ===== PRODUCT CATALOGUE API ENDPOINTS =====',
        keepEndMarker: true
    },
    {
        name: 'Product Catalogue',
        start: '// ===== PRODUCT CATALOGUE API ENDPOINTS =====',
        end: '// ===== PRODUCT BUNDLES API ENDPOINTS =====',
        keepEndMarker: true
    },
    {
        name: 'Product Bundles',
        start: '// ===== PRODUCT BUNDLES API ENDPOINTS =====',
        end: '// ===== PS AUDIT TRAIL API ENDPOINTS =====',
        keepEndMarker: true
    },
    {
        name: 'PS Audit Trail',
        start: '// ===== PS AUDIT TRAIL API ENDPOINTS =====',
        end: '// Serve static files from the public directory',
        keepEndMarker: true
    }
];

// Error handler code to insert
const ERROR_HANDLER_CODE = `
// ===== GLOBAL ERROR HANDLER =====
const { errorHandler } = require('./middleware/error-handler');

// Global error handler (must be last middleware)
app.use(errorHandler);

console.log('✅ Global error handler configured');

`;

console.log('🔧 App.js Cleanup Script');
console.log('========================\n');

// Step 1: Create backup
console.log('📦 Step 1: Creating backup...');
try {
    fs.copyFileSync(APP_JS_PATH, BACKUP_PATH);
    console.log(`✅ Backup created: ${BACKUP_PATH}\n`);
} catch (error) {
    console.error(`❌ Failed to create backup: ${error.message}`);
    process.exit(1);
}

// Step 2: Read app.js
console.log('📖 Step 2: Reading app.js...');
let content;
try {
    content = fs.readFileSync(APP_JS_PATH, 'utf8');
    const lines = content.split('\n');
    console.log(`✅ Read ${lines.length} lines\n`);
} catch (error) {
    console.error(`❌ Failed to read app.js: ${error.message}`);
    process.exit(1);
}

// Step 3: Remove sections
console.log('🗑️  Step 3: Removing extracted sections...\n');

let totalLinesRemoved = 0;

SECTIONS_TO_REMOVE.forEach((section, index) => {
    console.log(`   ${index + 1}. Removing ${section.name}...`);
    
    const startIndex = content.indexOf(section.start);
    const endIndex = content.indexOf(section.end, startIndex + 1);
    
    if (startIndex === -1) {
        console.log(`      ⚠️  Start marker not found, skipping`);
        return;
    }
    
    if (endIndex === -1) {
        console.log(`      ⚠️  End marker not found, skipping`);
        return;
    }
    
    const before = content.substring(0, startIndex);
    const after = section.keepEndMarker 
        ? content.substring(endIndex)
        : content.substring(endIndex + section.end.length);
    
    // Count lines removed
    const removed = content.substring(startIndex, section.keepEndMarker ? endIndex : endIndex + section.end.length);
    const linesRemoved = removed.split('\n').length;
    totalLinesRemoved += linesRemoved;
    
    // Add marker comment
    const marker = `// [${section.name.toUpperCase()} EXTRACTED - See routes/]\n\n`;
    content = before + marker + after;
    
    console.log(`      ✅ Removed ${linesRemoved} lines`);
});

console.log(`\n📊 Total lines removed: ${totalLinesRemoved}\n`);

// Step 4: Add error handler
console.log('➕ Step 4: Adding error handler...');
const staticFilesMarker = '// Serve static files from the public directory';
const staticFilesIndex = content.indexOf(staticFilesMarker);

if (staticFilesIndex !== -1) {
    const before = content.substring(0, staticFilesIndex);
    const after = content.substring(staticFilesIndex);
    content = before + ERROR_HANDLER_CODE + after;
    console.log('✅ Error handler added\n');
} else {
    console.log('⚠️  Could not find static files marker, error handler not added\n');
}

// Step 5: Write cleaned file
console.log('💾 Step 5: Writing cleaned app.js...');
try {
    fs.writeFileSync(APP_JS_PATH, content, 'utf8');
    const finalLines = content.split('\n').length;
    console.log(`✅ Wrote ${finalLines} lines\n`);
    
    console.log('📊 Summary:');
    console.log(`   Original lines: ~6,323`);
    console.log(`   Lines removed: ${totalLinesRemoved}`);
    console.log(`   Final lines: ${finalLines}`);
    console.log(`   Reduction: ${Math.round((totalLinesRemoved / 6323) * 100)}%\n`);
    
} catch (error) {
    console.error(`❌ Failed to write app.js: ${error.message}`);
    console.log('\n⚠️  Restoring from backup...');
    fs.copyFileSync(BACKUP_PATH, APP_JS_PATH);
    console.log('✅ Restored from backup');
    process.exit(1);
}

// Step 6: Verification
console.log('✅ Cleanup complete!\n');
console.log('🔍 Next steps:');
console.log('   1. Verify syntax: node --check app.js');
console.log('   2. Start server: node app.js');
console.log('   3. Test endpoints');
console.log('\n💡 If anything goes wrong, restore from: app.js.backup\n');

