/**
 * Setup Default Admin User
 * 
 * This script creates the default admin user if it doesn't exist.
 * Run this after setting up the database schema.
 * 
 * Usage: node setup-admin-user.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./database');

async function setupAdminUser() {
    console.log('🔧 Setting up default admin user...\n');

    try {
        // Get credentials from environment
        const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
        const password = process.env.DEFAULT_ADMIN_PASSWORD;
        const fullName = process.env.DEFAULT_ADMIN_FULL_NAME || 'System Administrator';

        if (!password) {
            console.error('❌ Error: DEFAULT_ADMIN_PASSWORD not set in environment variables');
            console.error('   Please set DEFAULT_ADMIN_PASSWORD in your .env file');
            process.exit(1);
        }

        if (password === 'change_this_password' || password.length < 8) {
            console.error('❌ Error: DEFAULT_ADMIN_PASSWORD is not secure');
            console.error('   Please use a strong password (at least 8 characters)');
            process.exit(1);
        }

        // Check if admin user already exists
        const existingUser = await pool.query(
            'SELECT id, username FROM users WHERE username = $1',
            [username]
        );

        if (existingUser.rows.length > 0) {
            console.log(`ℹ️  Admin user "${username}" already exists (ID: ${existingUser.rows[0].id})`);
            console.log('   Updating password and verifying admin role...');
            
            const userId = existingUser.rows[0].id;
            
            // Hash new password
            console.log('🔐 Hashing new password...');
            const passwordHash = await bcrypt.hash(password, 10);
            
            // Update password
            await pool.query(
                'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [passwordHash, userId]
            );
            console.log('   ✅ Password updated');
            
            // Check if user has admin role
            const adminRoleCheck = await pool.query(`
                SELECT r.name 
                FROM user_roles ur
                INNER JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = $1 AND r.name = 'admin'
            `, [userId]);

            if (adminRoleCheck.rows.length === 0) {
                console.log('   Adding admin role to existing user...');
                const adminRole = await pool.query('SELECT id FROM roles WHERE name = $1', ['admin']);
                if (adminRole.rows.length > 0) {
                    await pool.query(
                        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        [userId, adminRole.rows[0].id]
                    );
                    console.log('   ✅ Admin role assigned');
                }
            } else {
                console.log('   ✅ User already has admin role');
            }
            
            console.log('\n✅ Admin user reinitialized successfully!');
            console.log('\n📋 Admin User Details:');
            console.log(`   Username: ${username}`);
            console.log(`   Full Name: ${fullName}`);
            console.log(`   Role: admin`);
            console.log('\n🔐 You can now log in with the updated credentials from .env');
            
            return;
        }

        // Get admin role ID
        const adminRoleResult = await pool.query(
            'SELECT id FROM roles WHERE name = $1',
            ['admin']
        );

        if (adminRoleResult.rows.length === 0) {
            console.error('❌ Error: Admin role not found in database');
            console.error('   Please run the database migration script first (07-auth-system.sql)');
            process.exit(1);
        }

        const adminRoleId = adminRoleResult.rows[0].id;

        // Hash password
        console.log('🔐 Hashing password...');
        const passwordHash = await bcrypt.hash(password, 10);

        // Start transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Create admin user
            console.log(`👤 Creating admin user "${username}"...`);
            const userResult = await client.query(`
                INSERT INTO users (username, password_hash, full_name, is_active)
                VALUES ($1, $2, $3, TRUE)
                RETURNING id, username, full_name, created_at
            `, [username, passwordHash, fullName]);

            const newUser = userResult.rows[0];
            console.log(`   ✅ User created successfully (ID: ${newUser.id})`);

            // Assign admin role
            console.log('🎭 Assigning admin role...');
            await client.query(`
                INSERT INTO user_roles (user_id, role_id)
                VALUES ($1, $2)
            `, [newUser.id, adminRoleId]);
            console.log('   ✅ Admin role assigned');

            // Create audit log
            await client.query(`
                INSERT INTO auth_audit_log (
                    user_id, action, entity_type, entity_id, 
                    new_value, performed_by, created_at
                )
                VALUES ($1, $2, $3, $4, $5, NULL, CURRENT_TIMESTAMP)
            `, [
                newUser.id,
                'admin_user_created',
                'user',
                newUser.id,
                JSON.stringify({
                    username: newUser.username,
                    full_name: newUser.full_name,
                    role: 'admin'
                })
            ]);

            await client.query('COMMIT');

            console.log('\n✅ Default admin user setup complete!');
            console.log('\n📋 Admin User Details:');
            console.log(`   Username: ${newUser.username}`);
            console.log(`   Full Name: ${newUser.full_name}`);
            console.log(`   Role: admin`);
            console.log(`   Created: ${newUser.created_at}`);
            console.log('\n🔐 You can now log in with these credentials');
            console.log('   Remember to change the password after first login!');

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('\n❌ Error setting up admin user:', error.message);
        console.error('\nStack trace:', error.stack);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run if executed directly
if (require.main === module) {
    setupAdminUser().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { setupAdminUser };

