require('dotenv').config();
const { pool } = require('./database');

async function unlockUser(username) {
    console.log(`🔓 Unlocking user: ${username}...\n`);

    try {
        // Check if user exists
        const userCheck = await pool.query(
            'SELECT id, username, failed_login_attempts, locked_until FROM users WHERE username = $1',
            [username]
        );

        if (userCheck.rows.length === 0) {
            console.error(`❌ User "${username}" not found`);
            process.exit(1);
        }

        const user = userCheck.rows[0];
        
        console.log('📋 Current Status:');
        console.log(`   Username: ${user.username}`);
        console.log(`   Failed Attempts: ${user.failed_login_attempts}`);
        console.log(`   Locked Until: ${user.locked_until || 'Not locked'}`);
        
        // Unlock the user
        const result = await pool.query(`
            UPDATE users
            SET failed_login_attempts = 0,
                locked_until = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE username = $1
            RETURNING id, username
        `, [username]);

        if (result.rows.length > 0) {
            console.log('\n✅ User unlocked successfully!');
            console.log(`   Username: ${result.rows[0].username}`);
            console.log('   Failed attempts reset to 0');
            console.log('   Lockout removed');
            console.log('\n🔐 You can now log in with your credentials');
        }

    } catch (error) {
        console.error('\n❌ Error unlocking user:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Get username from command line or use default 'admin'
const username = process.argv[2] || 'admin';
unlockUser(username);

