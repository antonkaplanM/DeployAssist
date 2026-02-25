/**
 * Run User Settings database migration
 * Usage: node scripts/database/run-user-settings-migration.js
 */

require('dotenv').config();
const db = require('../../database');

async function runMigration() {
    console.log('Starting User Settings migration...\n');

    try {
        console.log('1. Creating user_settings table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_settings (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                setting_key VARCHAR(100) NOT NULL,
                setting_value TEXT,
                is_encrypted BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (user_id, setting_key)
            )
        `);
        console.log('   done');

        console.log('2. Creating indexes...');
        await db.query(`CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_user_settings_key ON user_settings(setting_key)`);
        console.log('   done');

        console.log('\nUser Settings migration complete!');
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

runMigration();
