const db = require('./database');

async function queryGhostAccountsWithApps() {
  try {
    const query = `
      SELECT DISTINCT 
        ga.account_name, 
        ga.account_id, 
        ga.ma_sf_link, 
        em.product_name, 
        em.product_category, 
        em.expiration_date
      FROM ghost_accounts ga
      JOIN expiration_monitor em ON ga.account_id = em.account_name
      WHERE em.expiration_date < CURRENT_DATE 
        AND em.product_category = 'Apps' 
        AND em.product_name NOT ILIKE '%CoD%'
      ORDER BY ga.account_name, em.product_name
    `;
    
    const result = await db.query(query);
    
    // Group by account
    const accountMap = new Map();
    result.rows.forEach(row => {
      if (!accountMap.has(row.account_name)) {
        accountMap.set(row.account_name, {
          account_name: row.account_name,
          account_id: row.account_id,
          ma_sf_link: row.ma_sf_link,
          expired_apps: []
        });
      }
      accountMap.get(row.account_name).expired_apps.push({
        product_name: row.product_name,
        expiration_date: row.expiration_date
      });
    });
    
    const accounts = Array.from(accountMap.values());
    
    console.log('\n=== GHOST ACCOUNTS WITH EXPIRED APPS (Excluding CoD) ===\n');
    console.log(`Total accounts found: ${accounts.length}\n`);
    
    accounts.forEach((account, index) => {
      console.log(`${index + 1}. ${account.account_name}`);
      console.log(`   Account ID: ${account.account_id}`);
      console.log(`   Salesforce Link: ${account.ma_sf_link}`);
      console.log(`   Expired Apps Products:`);
      account.expired_apps.forEach(app => {
        console.log(`      - ${app.product_name} (Expired: ${new Date(app.expiration_date).toLocaleDateString()})`);
      });
      console.log('');
    });
    
    // Also output JSON for programmatic use
    console.log('\n=== JSON OUTPUT ===\n');
    console.log(JSON.stringify(accounts, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Error querying database:', error);
    process.exit(1);
  }
}

queryGhostAccountsWithApps();



