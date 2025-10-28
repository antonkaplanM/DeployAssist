/**
 * Analyze PS Request Volume
 * 
 * Calculate the average number of PS requests created per week over the past 6 months
 * Based on the created_date field in the ps_audit_trail table
 */

const database = require('./database');

async function analyzePSRequestVolume() {
    console.log('📊 Analyzing PS Request Volume...\n');
    
    try {
        // Calculate date range: past 6 months
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 6);
        
        console.log(`📅 Analysis Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
        console.log(`   (${Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24))} days)\n`);
        
        // Query to get unique PS records created in the past 6 months
        // Group by week to see weekly trends
        const weeklyQuery = `
            WITH unique_ps_records AS (
                -- Get distinct PS records (one row per PS record, using earliest snapshot)
                SELECT DISTINCT ON (ps_record_id)
                    ps_record_id,
                    ps_record_name,
                    created_date,
                    account_name,
                    status,
                    request_type
                FROM ps_audit_trail
                WHERE created_date >= $1 
                  AND created_date <= $2
                  AND created_date IS NOT NULL
                ORDER BY ps_record_id, captured_at ASC
            ),
            weekly_aggregation AS (
                -- Group by week
                SELECT 
                    DATE_TRUNC('week', created_date) as week_start,
                    COUNT(*) as requests_created,
                    COUNT(DISTINCT account_name) as unique_accounts,
                    ARRAY_AGG(DISTINCT request_type) FILTER (WHERE request_type IS NOT NULL) as request_types
                FROM unique_ps_records
                GROUP BY DATE_TRUNC('week', created_date)
                ORDER BY week_start ASC
            )
            SELECT 
                week_start,
                TO_CHAR(week_start, 'Mon DD, YYYY') as week_label,
                requests_created,
                unique_accounts,
                request_types
            FROM weekly_aggregation
            ORDER BY week_start ASC
        `;
        
        const weeklyResult = await database.query(weeklyQuery, [startDate, endDate]);
        
        // Calculate overall statistics
        const statsQuery = `
            WITH unique_ps_records AS (
                SELECT DISTINCT ON (ps_record_id)
                    ps_record_id,
                    ps_record_name,
                    created_date,
                    account_name,
                    request_type
                FROM ps_audit_trail
                WHERE created_date >= $1 
                  AND created_date <= $2
                  AND created_date IS NOT NULL
                ORDER BY ps_record_id, captured_at ASC
            )
            SELECT 
                COUNT(*) as total_requests,
                COUNT(DISTINCT account_name) as unique_accounts,
                MIN(created_date) as earliest_request,
                MAX(created_date) as latest_request,
                COUNT(*) FILTER (WHERE request_type = 'New') as new_requests,
                COUNT(*) FILTER (WHERE request_type = 'Update') as update_requests,
                COUNT(*) FILTER (WHERE request_type = 'Deprovision') as deprovision_requests
            FROM unique_ps_records
        `;
        
        const statsResult = await database.query(statsQuery, [startDate, endDate]);
        const stats = statsResult.rows[0];
        
        // Display results
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('📈 WEEKLY BREAKDOWN');
        console.log('═══════════════════════════════════════════════════════════════\n');
        
        if (weeklyResult.rows.length === 0) {
            console.log('⚠️  No PS requests found in the specified date range.');
            console.log('    This might mean:');
            console.log('    - PS records are older than 6 months');
            console.log('    - The created_date field is not populated');
            console.log('    - The audit trail data hasn\'t been fully captured yet\n');
            return;
        }
        
        let totalRequestsFromWeeks = 0;
        weeklyResult.rows.forEach((week, index) => {
            totalRequestsFromWeeks += parseInt(week.requests_created);
            const requestTypes = week.request_types ? week.request_types.join(', ') : 'N/A';
            console.log(`Week ${index + 1}: ${week.week_label}`);
            console.log(`  • Requests Created: ${week.requests_created}`);
            console.log(`  • Unique Accounts: ${week.unique_accounts}`);
            console.log(`  • Request Types: ${requestTypes}`);
            console.log('');
        });
        
        // Calculate averages
        const totalWeeks = weeklyResult.rows.length;
        const averagePerWeek = totalWeeks > 0 ? (totalRequestsFromWeeks / totalWeeks).toFixed(2) : 0;
        const daysInPeriod = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
        const weeksInPeriod = daysInPeriod / 7;
        
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('📊 OVERALL STATISTICS');
        console.log('═══════════════════════════════════════════════════════════════\n');
        
        console.log(`Total PS Requests (6 months):  ${stats.total_requests}`);
        console.log(`Unique Accounts:                ${stats.unique_accounts}`);
        console.log(`Analysis Period:                ${daysInPeriod} days (~${weeksInPeriod.toFixed(1)} weeks)`);
        console.log(`Weeks with Activity:            ${totalWeeks}`);
        console.log('');
        console.log(`📈 Average per Week:            ${averagePerWeek} requests`);
        console.log(`📈 Average per Day:             ${(totalRequestsFromWeeks / daysInPeriod).toFixed(2)} requests`);
        console.log('');
        
        console.log('Request Type Breakdown:');
        console.log(`  • New:         ${stats.new_requests || 0} (${stats.total_requests > 0 ? ((stats.new_requests / stats.total_requests) * 100).toFixed(1) : 0}%)`);
        console.log(`  • Update:      ${stats.update_requests || 0} (${stats.total_requests > 0 ? ((stats.update_requests / stats.total_requests) * 100).toFixed(1) : 0}%)`);
        console.log(`  • Deprovision: ${stats.deprovision_requests || 0} (${stats.total_requests > 0 ? ((stats.deprovision_requests / stats.total_requests) * 100).toFixed(1) : 0}%)`);
        console.log('');
        
        if (stats.earliest_request && stats.latest_request) {
            console.log(`Earliest Request: ${new Date(stats.earliest_request).toISOString().split('T')[0]}`);
            console.log(`Latest Request:   ${new Date(stats.latest_request).toISOString().split('T')[0]}`);
        }
        
        console.log('\n═══════════════════════════════════════════════════════════════');
        
        // Return summary for programmatic use
        return {
            success: true,
            period: {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                daysInPeriod,
                weeksInPeriod: parseFloat(weeksInPeriod.toFixed(1))
            },
            totals: {
                totalRequests: parseInt(stats.total_requests),
                uniqueAccounts: parseInt(stats.unique_accounts),
                weeksWithActivity: totalWeeks
            },
            averages: {
                requestsPerWeek: parseFloat(averagePerWeek),
                requestsPerDay: parseFloat((totalRequestsFromWeeks / daysInPeriod).toFixed(2))
            },
            requestTypes: {
                new: parseInt(stats.new_requests || 0),
                update: parseInt(stats.update_requests || 0),
                deprovision: parseInt(stats.deprovision_requests || 0)
            },
            weeklyData: weeklyResult.rows
        };
        
    } catch (error) {
        console.error('❌ Error analyzing PS request volume:', error.message);
        console.error(error.stack);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run the analysis
if (require.main === module) {
    analyzePSRequestVolume()
        .then(() => {
            console.log('\n✅ Analysis complete');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { analyzePSRequestVolume };




