/**
 * PS Audit Trail Database Setup Script
 * 
 * This script initializes the PS audit trail database schema.
 * The audit trail captures snapshots of all PS records over time to track status changes.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const database = require('./database');

async function setupPSAuditTrail() {
    console.log('🚀 Starting PS Audit Trail setup...');
    
    try {
        // Read the SQL initialization script
        const sqlPath = path.join(__dirname, 'database', 'init-scripts', '09-ps-audit-trail.sql');
        console.log(`📄 Reading SQL script from: ${sqlPath}`);
        
        if (!fs.existsSync(sqlPath)) {
            throw new Error(`SQL script not found at: ${sqlPath}`);
        }
        
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Execute the SQL script
        console.log('⚙️  Executing PS audit trail schema creation...');
        await database.query(sql);
        
        console.log('✅ PS Audit Trail schema created successfully!');
        console.log('');
        console.log('📊 Database objects created:');
        console.log('   - Table: ps_audit_trail');
        console.log('   - Table: ps_audit_log');
        console.log('   - View: ps_audit_latest');
        console.log('   - Function: get_ps_audit_trail(identifier)');
        console.log('   - Function: get_ps_status_changes(identifier)');
        console.log('   - Function: get_ps_audit_stats()');
        console.log('');
        
        // Verify the setup by checking stats
        console.log('🔍 Verifying setup...');
        const statsResult = await database.query('SELECT * FROM get_ps_audit_stats()');
        
        if (statsResult.rows && statsResult.rows.length > 0) {
            const stats = statsResult.rows[0];
            console.log('✅ Verification successful!');
            console.log(`   Total PS Records: ${stats.total_ps_records}`);
            console.log(`   Total Snapshots: ${stats.total_snapshots}`);
            console.log(`   Status Changes: ${stats.total_status_changes}`);
            console.log('');
        }
        
        console.log('✅ PS Audit Trail setup complete!');
        console.log('');
        console.log('📝 Next steps:');
        console.log('   1. Run pre-population script to capture existing PS records');
        console.log('   2. Set up periodic capture to track changes over time');
        console.log('   3. Access the Audit Trail page to search for PS record history');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error setting up PS Audit Trail:', error.message);
        console.error(error);
        process.exit(1);
    }
}

// Run the setup
setupPSAuditTrail();

