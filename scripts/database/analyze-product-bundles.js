/**
 * Analyze Product Bundles Script
 * Identifies bundle products (those with multiple RI Subregion values)
 * and finds their constituent base products
 */

const db = require('../../database.js');

async function analyzeProductBundles() {
    try {
        console.log('🔍 Analyzing Product Bundles...\n');
        
        // Step 1: Find all products with their RI Subregion values
        console.log('Step 1: Fetching products with RI Subregion data...');
        const allProductsQuery = `
            SELECT 
                id,
                product_code,
                name,
                ri_platform_sub_region,
                is_active
            FROM products
            WHERE is_active = true 
            AND ri_platform_sub_region IS NOT NULL
            ORDER BY product_code
        `;
        
        const allProducts = await db.query(allProductsQuery);
        console.log(`   Found ${allProducts.rows.length} active products with RI Subregion data\n`);
        
        // Step 2: Identify bundles (products with multiple subregion values)
        console.log('Step 2: Identifying bundle products...');
        const bundles = [];
        const baseProducts = [];
        
        for (const product of allProducts.rows) {
            const subregions = product.ri_platform_sub_region.split(';').map(s => s.trim()).filter(s => s);
            
            if (subregions.length > 1) {
                bundles.push({
                    ...product,
                    subregions: subregions
                });
            } else if (subregions.length === 1) {
                baseProducts.push({
                    ...product,
                    subregion: subregions[0]
                });
            }
        }
        
        console.log(`   Bundles found: ${bundles.length}`);
        console.log(`   Base products found: ${baseProducts.length}\n`);
        
        // Step 3: Show sample bundles
        console.log('Step 3: Sample Bundle Products:');
        bundles.slice(0, 10).forEach(bundle => {
            console.log(`   ${bundle.product_code} | ${bundle.name}`);
            console.log(`      Subregions: ${bundle.subregions.join(', ')}`);
        });
        console.log('');
        
        // Step 4: For each bundle, find constituent base products
        console.log('Step 4: Finding constituents for bundles...\n');
        
        const bundleConstituents = [];
        
        for (const bundle of bundles) {
            const constituents = [];
            
            for (const subregion of bundle.subregions) {
                // Find base products that have this exact subregion
                const matchingProducts = baseProducts.filter(bp => 
                    bp.subregion === subregion
                );
                
                constituents.push(...matchingProducts.map(p => p.product_code));
            }
            
            // Remove duplicates
            const uniqueConstituents = [...new Set(constituents)];
            
            bundleConstituents.push({
                bundleCode: bundle.product_code,
                bundleName: bundle.name,
                subregions: bundle.subregions,
                constituents: uniqueConstituents,
                constituentCount: uniqueConstituents.length
            });
        }
        
        // Step 5: Show results
        console.log('Step 5: Bundle Analysis Results:');
        console.log(`   Total bundles: ${bundleConstituents.length}`);
        console.log(`   Bundles with constituents: ${bundleConstituents.filter(b => b.constituentCount > 0).length}`);
        console.log(`   Bundles without constituents: ${bundleConstituents.filter(b => b.constituentCount === 0).length}\n`);
        
        // Show detailed examples
        console.log('Detailed Examples (first 5 bundles with constituents):\n');
        bundleConstituents
            .filter(b => b.constituentCount > 0)
            .slice(0, 5)
            .forEach(bundle => {
                console.log(`📦 BUNDLE: ${bundle.bundleCode} - ${bundle.bundleName}`);
                console.log(`   Subregions: ${bundle.subregions.join(', ')}`);
                console.log(`   Constituents (${bundle.constituentCount}): ${bundle.constituents.join(', ')}`);
                console.log('');
            });
        
        // Step 6: Show bundles without constituents
        const bundlesWithoutConstituents = bundleConstituents.filter(b => b.constituentCount === 0);
        if (bundlesWithoutConstituents.length > 0) {
            console.log(`\n⚠️  Bundles WITHOUT matching constituents (${bundlesWithoutConstituents.length}):`);
            bundlesWithoutConstituents.slice(0, 10).forEach(bundle => {
                console.log(`   ${bundle.bundleCode}: ${bundle.subregions.join(', ')}`);
            });
        }
        
        // Step 7: Generate summary statistics
        console.log('\n📊 Summary Statistics:');
        console.log(`   Total active products: ${allProducts.rows.length}`);
        console.log(`   Base products (single subregion): ${baseProducts.length}`);
        console.log(`   Bundle products (multiple subregions): ${bundles.length}`);
        console.log(`   Percentage of bundles: ${((bundles.length / allProducts.rows.length) * 100).toFixed(1)}%`);
        
        const avgConstituents = bundleConstituents.reduce((sum, b) => sum + b.constituentCount, 0) / bundleConstituents.length;
        console.log(`   Average constituents per bundle: ${avgConstituents.toFixed(1)}`);
        
        return {
            allProducts: allProducts.rows,
            baseProducts,
            bundles,
            bundleConstituents
        };
        
    } catch (error) {
        console.error('❌ Error analyzing product bundles:', error.message);
        throw error;
    } finally {
        await db.pool.end();
    }
}

// Run the analysis
analyzeProductBundles()
    .then(() => {
        console.log('\n✅ Analysis complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Analysis failed:', error);
        process.exit(1);
    });

