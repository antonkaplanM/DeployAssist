/**
 * Package Change Analysis Service
 * Business logic for package change analytics
 */

const ExcelJS = require('exceljs');
const salesforce = require('../salesforce');
const db = require('../database');
const logger = require('../utils/logger');
const { UnauthorizedError, InternalServerError } = require('../middleware/error-handler');

class PackageChangesService {
    /**
     * Get package change summary statistics
     * @param {String} timeFrame - Time frame for analysis
     * @returns {Promise<Object>} Summary data
     */
    async getPackageChangeSummary(timeFrame = '1y') {
        logger.debug('Package change summary requested', { timeFrame });
        
        const result = await db.getPackageChangeSummary(timeFrame);
        
        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to fetch package change summary');
        }
        
        return {
            summary: result.summary,
            timeFrame: result.timeFrame,
            startDate: result.startDate,
            endDate: result.endDate
        };
    }

    /**
     * Get package changes grouped by product
     * @param {String} timeFrame - Time frame for analysis
     * @returns {Promise<Object>} Package changes by product
     */
    async getPackageChangesByProduct(timeFrame = '1y') {
        logger.debug('Package changes by product requested', { timeFrame });
        
        const result = await db.getPackageChangesByProduct(timeFrame);
        
        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to fetch package changes by product');
        }
        
        return {
            data: result.data,
            count: result.count,
            timeFrame: result.timeFrame
        };
    }

    /**
     * Get package changes grouped by account
     * @param {String} timeFrame - Time frame for analysis
     * @param {Number} limit - Maximum results (optional)
     * @returns {Promise<Object>} Package changes by account
     */
    async getPackageChangesByAccount(timeFrame = '1y', limit = null) {
        logger.debug('Package changes by account requested', { timeFrame, limit });
        
        const result = await db.getPackageChangesByAccount(timeFrame, limit);
        
        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to fetch package changes by account');
        }
        
        return {
            data: result.data,
            count: result.count,
            timeFrame: result.timeFrame
        };
    }

    /**
     * Get recent package changes
     * @param {Number} limit - Maximum results
     * @returns {Promise<Object>} Recent package changes
     */
    async getRecentPackageChanges(limit = 20) {
        logger.debug('Recent package changes requested', { limit });
        
        const result = await db.getRecentPackageChanges(limit);
        
        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to fetch recent package changes');
        }
        
        return {
            data: result.data,
            count: result.count
        };
    }

    /**
     * Trigger package change analysis refresh
     * @param {Number} lookbackYears - Years to look back
     * @returns {Promise<Object>} Analysis results
     */
    async refreshPackageChangeAnalysis(lookbackYears = 2) {
        logger.info(`Starting package change analysis: ${lookbackYears} year lookback`);
        
        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            throw new UnauthorizedError('No Salesforce authentication available');
        }
        
        const analysisStarted = new Date();
        
        try {
            const result = await salesforce.analyzePackageChanges(lookbackYears);
            
            const analysisCompleted = new Date();
            const durationSeconds = (analysisCompleted - analysisStarted) / 1000;
            
            if (!result.success) {
                // Log the failed analysis
                await db.logPackageChangeAnalysis({
                    analysisStarted: analysisStarted,
                    analysisCompleted: new Date(),
                    recordsAnalyzed: 0,
                    deploymentsProcessed: 0,
                    changesFound: 0,
                    upgradesFound: 0,
                    downgradesFound: 0,
                    psRecordsWithChanges: 0,
                    accountsAffected: 0,
                    lookbackYears: lookbackYears,
                    status: 'failed',
                    errorMessage: result.error
                });
                
                throw new InternalServerError(result.error || 'Package change analysis failed');
            }
            
            // Clear existing cache
            await db.clearPackageChangeCache();
            
            // Insert new package change data into database
            if (result.packageChanges && result.packageChanges.length > 0) {
                await db.insertPackageChangeData(result.packageChanges);
            }
            
            // Log the analysis
            await db.logPackageChangeAnalysis({
                analysisStarted: analysisStarted,
                analysisCompleted: analysisCompleted,
                recordsAnalyzed: result.recordsAnalyzed,
                deploymentsProcessed: result.deploymentsProcessed,
                changesFound: result.changesFound,
                upgradesFound: result.upgradesFound,
                downgradesFound: result.downgradesFound,
                psRecordsWithChanges: result.psRecordsWithChanges,
                accountsAffected: result.accountsAffected,
                lookbackYears: lookbackYears,
                startDate: result.startDate,
                endDate: result.endDate,
                status: 'completed'
            });
            
            logger.info(`Package change analysis complete: ${result.changesFound} changes found (${result.upgradesFound} upgrades, ${result.downgradesFound} downgrades)`);
            
            return {
                message: 'Package change analysis completed successfully',
                summary: {
                    recordsAnalyzed: result.recordsAnalyzed,
                    deploymentsProcessed: result.deploymentsProcessed,
                    changesFound: result.changesFound,
                    upgradesFound: result.upgradesFound,
                    downgradesFound: result.downgradesFound,
                    psRecordsWithChanges: result.psRecordsWithChanges,
                    accountsAffected: result.accountsAffected,
                    lookbackYears: lookbackYears,
                    duration: durationSeconds
                }
            };
        } catch (err) {
            // Log the error
            await db.logPackageChangeAnalysis({
                analysisStarted: analysisStarted,
                analysisCompleted: new Date(),
                recordsAnalyzed: 0,
                deploymentsProcessed: 0,
                changesFound: 0,
                upgradesFound: 0,
                downgradesFound: 0,
                psRecordsWithChanges: 0,
                accountsAffected: 0,
                lookbackYears: lookbackYears,
                status: 'failed',
                errorMessage: err.message
            });
            
            throw err;
        }
    }

    /**
     * Get package change analysis status
     * @returns {Promise<Object>} Analysis status
     */
    async getPackageChangeAnalysisStatus() {
        const analysisStatus = await db.getLatestPackageChangeAnalysisStatus();
        
        if (!analysisStatus.success) {
            throw new InternalServerError(analysisStatus.error || 'Failed to get package change analysis status');
        }
        
        if (!analysisStatus.hasAnalysis) {
            return {
                hasAnalysis: false,
                message: 'No analysis has been run yet. Click "Refresh" to analyze package changes.'
            };
        }
        
        const analysis = analysisStatus.analysis;
        
        // Calculate age of analysis
        const analysisAge = new Date() - new Date(analysis.analysis_completed);
        const ageHours = Math.floor(analysisAge / (1000 * 60 * 60));
        const ageMinutes = Math.floor((analysisAge % (1000 * 60 * 60)) / (1000 * 60));
        
        let ageText;
        if (ageHours > 24) {
            const ageDays = Math.floor(ageHours / 24);
            ageText = `${ageDays} day${ageDays !== 1 ? 's' : ''} ago`;
        } else if (ageHours > 0) {
            ageText = `${ageHours} hour${ageHours !== 1 ? 's' : ''} ago`;
        } else {
            ageText = `${ageMinutes} minute${ageMinutes !== 1 ? 's' : ''} ago`;
        }
        
        return {
            hasAnalysis: true,
            analysis: {
                lastRun: analysis.analysis_completed,
                lastRunAgo: ageText,
                status: analysis.status,
                recordsAnalyzed: analysis.records_analyzed,
                deploymentsProcessed: analysis.deployments_processed,
                changesFound: analysis.changes_found,
                upgradesFound: analysis.upgrades_found,
                downgradesFound: analysis.downgrades_found,
                psRecordsWithChanges: analysis.ps_records_with_changes,
                accountsAffected: analysis.accounts_affected,
                lookbackYears: analysis.lookback_years,
                errorMessage: analysis.error_message
            }
        };
    }

    /**
     * Export package changes to Excel
     * @param {String} timeFrame - Time frame for analysis
     * @returns {Promise<Object>} Workbook object (ready to write to response)
     */
    async exportPackageChangesToExcel(timeFrame = '1y') {
        logger.info('Package changes Excel export requested', { timeFrame });
        
        // Fetch all data
        const [summaryResult, byProductResult, byAccountResult, recentResult] = await Promise.all([
            db.getPackageChangeSummary(timeFrame),
            db.getPackageChangesByProduct(timeFrame),
            db.getPackageChangesByAccount(timeFrame),
            db.getRecentPackageChanges(100)
        ]);
        
        // Check all results for success
        if (!summaryResult || !summaryResult.success || !summaryResult.summary) {
            throw new InternalServerError('Failed to fetch summary data: ' + (summaryResult?.error || 'No data returned'));
        }
        
        if (!byProductResult || !byProductResult.success || !byProductResult.data) {
            throw new InternalServerError('Failed to fetch product data: ' + (byProductResult?.error || 'No data returned'));
        }
        
        if (!byAccountResult || !byAccountResult.success || !byAccountResult.data) {
            throw new InternalServerError('Failed to fetch account data: ' + (byAccountResult?.error || 'No data returned'));
        }
        
        if (!recentResult || !recentResult.success || !recentResult.data) {
            throw new InternalServerError('Failed to fetch recent changes: ' + (recentResult?.error || 'No data returned'));
        }
        
        logger.info('All data fetched successfully for Excel export');
        
        // Create workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Risk Management System';
        workbook.created = new Date();
        
        // Define common styles
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } },
            alignment: { vertical: 'middle', horizontal: 'left' },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };
        
        // Sheet 1: Summary
        const summarySheet = workbook.addWorksheet('Summary', {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }]
        });
        
        summarySheet.columns = [
            { width: 30 },
            { width: 15 },
            { width: 15 },
            { width: 15 }
        ];
        
        // Add title
        summarySheet.mergeCells('A1:D1');
        const titleCell = summarySheet.getCell('A1');
        titleCell.value = 'Package Changes Analysis - Summary';
        titleCell.font = { bold: true, size: 14 };
        titleCell.alignment = { horizontal: 'center' };
        
        // Add metadata
        summarySheet.getCell('A2').value = `Time Frame: ${timeFrame}`;
        summarySheet.getCell('C2').value = `Generated: ${new Date().toLocaleString()}`;
        
        // Add headers
        summarySheet.getRow(4).values = ['Metric', 'Total', 'Upgrades', 'Downgrades'];
        summarySheet.getRow(4).eachCell((cell) => {
            cell.style = headerStyle;
        });
        
        // Add summary data
        const summary = summaryResult.summary;
        const summaryData = [
            ['Total Changes', summary.total_changes, summary.total_upgrades, summary.total_downgrades],
            ['PS Records with Changes', summary.ps_records_with_changes, '-', '-'],
            ['Accounts Affected', summary.accounts_affected, '-', '-'],
            ['Deployments', summary.deployments_affected, '-', '-'],
            ['Products Changed', summary.products_changed, '-', '-']
        ];
        
        summaryData.forEach((row, idx) => {
            const rowNum = idx + 5;
            summarySheet.getRow(rowNum).values = row;
            summarySheet.getRow(rowNum).eachCell((cell, colNum) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                if (colNum > 1 && cell.value !== '-') {
                    cell.numFmt = '#,##0';
                }
            });
        });
        
        // Sheet 2: By Account (with hierarchy)
        const accountSheet = workbook.addWorksheet('By Account', {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }]
        });
        
        accountSheet.columns = [
            { width: 50 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 }
        ];
        
        // Add title
        accountSheet.mergeCells('A1:F1');
        const accountTitleCell = accountSheet.getCell('A1');
        accountTitleCell.value = 'Package Changes by Account';
        accountTitleCell.font = { bold: true, size: 14 };
        accountTitleCell.alignment = { horizontal: 'center' };
        
        // Add headers
        accountSheet.getRow(2).values = ['Account / Deployment / Product', 'Total Changes', 'Upgrades', 'Downgrades', 'PS Records', 'Products'];
        accountSheet.getRow(2).eachCell((cell) => {
            cell.style = headerStyle;
        });
        
        // Add account data with hierarchy
        let currentRow = 3;
        if (byAccountResult.success && byAccountResult.data) {
            byAccountResult.data.forEach(account => {
                // Account row
                const accountRow = accountSheet.getRow(currentRow++);
                accountRow.values = [
                    account.account_name,
                    account.total_changes,
                    account.upgrades,
                    account.downgrades,
                    account.ps_records,
                    account.products_changed
                ];
                accountRow.font = { bold: true };
                accountRow.eachCell((cell, colNum) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    if (colNum > 1) {
                        cell.numFmt = '#,##0';
                    }
                });
                
                // Deployment rows
                if (account.deployments && account.deployments.length > 0) {
                    account.deployments.forEach(deployment => {
                        const deployRow = accountSheet.getRow(currentRow++);
                        const deploymentLabel = deployment.tenant_name 
                            ? `  ${deployment.deployment_number} (${deployment.tenant_name})`
                            : `  ${deployment.deployment_number}`;
                        deployRow.values = [
                            deploymentLabel,
                            deployment.total_changes,
                            deployment.upgrades,
                            deployment.downgrades,
                            deployment.ps_records,
                            deployment.products_changed
                        ];
                        deployRow.font = { italic: true };
                        deployRow.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFF5F5F5' }
                        };
                        deployRow.eachCell((cell, colNum) => {
                            cell.border = {
                                top: { style: 'thin' },
                                left: { style: 'thin' },
                                bottom: { style: 'thin' },
                                right: { style: 'thin' }
                            };
                            if (colNum > 1) {
                                cell.numFmt = '#,##0';
                            }
                        });
                        
                        // Product rows
                        if (deployment.products && deployment.products.length > 0) {
                            deployment.products.forEach(product => {
                                const productRow = accountSheet.getRow(currentRow++);
                                productRow.values = [
                                    `    ${product.product_code}`,
                                    product.total_changes,
                                    product.upgrades,
                                    product.downgrades,
                                    product.ps_records,
                                    '-'
                                ];
                                productRow.font = { size: 9 };
                                productRow.fill = {
                                    type: 'pattern',
                                    pattern: 'solid',
                                    fgColor: { argb: 'FFECECEC' }
                                };
                                productRow.eachCell((cell, colNum) => {
                                    cell.border = {
                                        top: { style: 'thin' },
                                        left: { style: 'thin' },
                                        bottom: { style: 'thin' },
                                        right: { style: 'thin' }
                                    };
                                    if (colNum > 1 && cell.value !== '-') {
                                        cell.numFmt = '#,##0';
                                    }
                                });
                            });
                        }
                    });
                }
            });
        }
        
        // Sheet 3: By Product
        const productSheet = workbook.addWorksheet('By Product', {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }]
        });
        
        productSheet.columns = [
            { width: 40 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 }
        ];
        
        // Add title
        productSheet.mergeCells('A1:F1');
        const productTitleCell = productSheet.getCell('A1');
        productTitleCell.value = 'Package Changes by Product';
        productTitleCell.font = { bold: true, size: 14 };
        productTitleCell.alignment = { horizontal: 'center' };
        
        // Add headers
        productSheet.getRow(2).values = ['Product', 'Total Changes', 'Upgrades', 'Downgrades', 'PS Records', 'Accounts'];
        productSheet.getRow(2).eachCell((cell) => {
            cell.style = headerStyle;
        });
        
        // Add product data
        if (byProductResult.success && byProductResult.data) {
            byProductResult.data.forEach((product, idx) => {
                const row = productSheet.getRow(idx + 3);
                row.values = [
                    product.product_name || product.product_code,
                    product.total_changes,
                    product.upgrades,
                    product.downgrades,
                    product.ps_records,
                    product.accounts
                ];
                row.eachCell((cell, colNum) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    if (colNum > 1) {
                        cell.numFmt = '#,##0';
                    }
                });
            });
        }
        
        // Sheet 4: Recent Changes
        const recentSheet = workbook.addWorksheet('Recent Changes', {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }]
        });
        
        recentSheet.columns = [
            { width: 15 },
            { width: 30 },
            { width: 20 },
            { width: 20 },
            { width: 30 },
            { width: 20 },
            { width: 15 },
            { width: 15 }
        ];
        
        // Add title
        recentSheet.mergeCells('A1:H1');
        const recentTitleCell = recentSheet.getCell('A1');
        recentTitleCell.value = 'Recent Package Changes';
        recentTitleCell.font = { bold: true, size: 14 };
        recentTitleCell.alignment = { horizontal: 'center' };
        
        // Add headers
        recentSheet.getRow(2).values = ['PS Record', 'Account', 'Deployment', 'Tenant Name', 'Product', 'Package Change', 'Change Type', 'Date'];
        recentSheet.getRow(2).eachCell((cell) => {
            cell.style = headerStyle;
        });
        
        // Add recent changes data
        if (recentResult.success && recentResult.data) {
            recentResult.data.forEach((change, idx) => {
                const row = recentSheet.getRow(idx + 3);
                row.values = [
                    change.ps_record_name,
                    change.account_name,
                    change.deployment_number,
                    change.tenant_name || '-',
                    change.product_code,
                    `${change.previous_package} → ${change.new_package}`,
                    change.change_type === 'upgrade' ? '↑ Upgrade' : '↓ Downgrade',
                    new Date(change.ps_created_date)
                ];
                row.eachCell((cell, colNum) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    if (colNum === 8) { // Date column
                        cell.numFmt = 'mm/dd/yyyy';
                    }
                    if (colNum === 7) { // Change Type column
                        if (change.change_type === 'upgrade') {
                            cell.font = { color: { argb: 'FF15803D' } };
                        } else {
                            cell.font = { color: { argb: 'FFC2410C' } };
                        }
                    }
                });
            });
        }
        
        logger.info('Excel export completed successfully');
        
        return {
            workbook,
            filename: `Package_Changes_${timeFrame}_${Date.now()}.xlsx`
        };
    }
}

module.exports = new PackageChangesService();

