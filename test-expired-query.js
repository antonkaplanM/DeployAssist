const db = require('./database');

async function testQuery() {
    try {
        console.log('Testing expired products query...\n');
        
        const category = 'Apps';
        const excludeProduct = 'CoD';
        const includeGhostAccountsOnly = true;
        const limit = 500;
        
        // Build the query
        let query = `
            SELECT 
                em.account_name,
                em.product_name,
                em.product_category,
                em.expiration_date,
                em.region,
                em.ma_sf_account_id,
                ga.id as ghost_account_id
            FROM expiration_monitor em
            LEFT JOIN ghost_accounts ga ON em.account_name = ga.account_name
            WHERE em.expiration_date < CURRENT_DATE
        `;
        
        const params = [];
        let paramIndex = 1;
        
        // Add filters
        if (category) {
            query += ` AND em.product_category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }
        
        if (excludeProduct) {
            query += ` AND em.product_name NOT ILIKE $${paramIndex}`;
            params.push(`%${excludeProduct}%`);
            paramIndex++;
        }
        
        if (includeGhostAccountsOnly) {
            query += ` AND ga.id IS NOT NULL`;
        }
        
        query += ` ORDER BY em.account_name, em.product_name`;
        query += ` LIMIT $${paramIndex}`;
        params.push(parseInt(limit));
        
        console.log('Query:', query);
        console.log('Params:', params);
        console.log('\nExecuting...\n');
        
        const result = await db.query(query, params);
        
        console.log(`Found ${result.rows.length} results\n`);
        
        // Group by account
        const accountMap = new Map();
        
        result.rows.forEach(row => {
            if (!accountMap.has(row.account_name)) {
                accountMap.set(row.account_name, {
                    account_name: row.account_name,
                    ma_sf_account_id: row.ma_sf_account_id,
                    ma_sf_link: row.ma_sf_account_id ? 
                        `https://moodysanalytics.my.salesforce.com/${row.ma_sf_account_id}` : null,
                    is_ghost_account: row.ghost_account_id !== null,
                    region: row.region,
                    expired_products: []
                });
            }
            
            accountMap.get(row.account_name).expired_products.push({
                product_name: row.product_name,
                product_category: row.product_category,
                expiration_date: row.expiration_date
            });
        });
        
        const accounts = Array.from(accountMap.values());
        
        console.log(`\n=== GHOST ACCOUNTS WITH EXPIRED APPS (Excluding CoD) ===\n`);
        console.log(`Total accounts: ${accounts.length}\n`);
        
        accounts.forEach((account, index) => {
            console.log(`${index + 1}. ${account.account_name}`);
            console.log(`   Salesforce: ${account.ma_sf_link}`);
            console.log(`   Region: ${account.region}`);
            console.log(`   Expired Apps Products (${account.expired_products.length}):`);
            account.expired_products.forEach(app => {
                console.log(`      - ${app.product_name} (Expired: ${new Date(app.expiration_date).toLocaleDateString()})`);
            });
            console.log('');
        });
        
        console.log('\n=== SUMMARY ===');
        console.log(`Total Accounts: ${accounts.length}`);
        console.log(`Total Expired Apps Products: ${result.rows.length}`);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testQuery();



