/**
 * Script to analyze ghost accounts for expired App products (excluding CoD)
 */

const http = require('http');

const API_BASE = 'localhost';
const API_PORT = 5000;

// All 40 ghost account IDs
const ghostAccounts = [
  "Bank of Ireland Group Public Limited Company",
  "BOCHK Asset Management Limited",
  "The Vistria Group, LP",
  "Barclays Execution Services Limited",
  "Blue Sky Risk",
  "Pacific Investment Management Company LLC (PIMCO)",
  "Massachusetts Institute of Technology (MIT) - Center for Real Estate",
  "BDO USA, P.C.",
  "Baillie Gifford & Co Limited",
  "Hungarian Central Bank (Magyar Nemzeti Bank) MNB",
  "Eurazeo SE",
  "FCCI Insurance Group",
  "RBC Capital Markets, LLC",
  "University of Massachusetts Lowell",
  "University of California Berkeley",
  "RealTerm Global",
  "Permodalan Nasional Berhad",
  "Woodbourne Canada Partners IV (CA) LP",
  "Stoneweg US, LLC.",
  "Lionstone Investments",
  "Sun Life Assurance Company of Canada (U.S.)",
  "Acadia Realty Limited Partnership",
  "Bank of England",
  "EPR Properties",
  "Measurabl",
  "iStar Inc. (f/k/a iStar Financial Inc.)",
  "Banque de France",
  "SACE SRV S.r.l.",
  "Wells Fargo Bank NA",
  "Stockbridge Capital Group, LLC",
  "Lockton Companies LLP",
  "Lam Research Corporation",
  "Systima Capital Management LLC",
  "Crow Holdings Capital Partners, L.L.C",
  "The Mauritius Commercial Bank Limited",
  "Top Spots",
  "IFM Investors (UK) Ltd",
  "The Wharton School University of Pennsylvania",
  "Deloitte LLP",
  "Banco Santander, S.A."
];

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_BASE,
      port: API_PORT,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (err) {
          reject(new Error(`Failed to parse response: ${err.message}`));
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.end();
  });
}

async function analyzeAccount(accountId) {
  try {
    const path = `/api/ghost-accounts/${encodeURIComponent(accountId)}/products?category=App&excludeProduct=CoD`;
    const response = await makeRequest(path);
    
    if (response.success && response.products && response.products.length > 0) {
      return {
        accountId: accountId,
        accountName: response.accountName,
        products: response.products,
        summary: response.summary
      };
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Error analyzing ${accountId}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🔍 Analyzing 40 ghost accounts for expired App products (excluding CoD)...\n');
  
  const accountsWithApps = [];
  
  for (let i = 0; i < ghostAccounts.length; i++) {
    const accountId = ghostAccounts[i];
    console.log(`[${i + 1}/${ghostAccounts.length}] Analyzing: ${accountId}`);
    
    const result = await analyzeAccount(accountId);
    
    if (result) {
      accountsWithApps.push(result);
      console.log(`  ✅ Found ${result.products.length} expired App product(s)`);
    } else {
      console.log(`  ⚪ No expired App products (excluding CoD)`);
    }
    
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 SUMMARY: ${accountsWithApps.length} ghost accounts with expired App products (excluding CoD)\n`);
  
  if (accountsWithApps.length > 0) {
    console.log('Accounts with expired App products:\n');
    
    accountsWithApps.forEach((account, index) => {
      console.log(`${index + 1}. ${account.accountName}`);
      console.log(`   Total expired App products: ${account.summary.total}`);
      console.log(`   Products:`);
      account.products.forEach(product => {
        console.log(`     - ${product.product_name} (Code: ${product.product_code}, Expired: ${product.end_date})`);
      });
      console.log('');
    });
  } else {
    console.log('No ghost accounts found with expired App products (excluding CoD).');
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

