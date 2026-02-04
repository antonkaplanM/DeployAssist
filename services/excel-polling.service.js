/**
 * Excel Polling Service
 * 
 * Monitors a shared Excel file for lookup requests and processes them.
 * This enables remote users to trigger lookups via Excel without direct API access.
 * 
 * Flow:
 * 1. Remote user sets FLAG cell to "PENDING" in the Lookup sheet
 * 2. This service polls the Excel file via Microsoft Graph API
 * 3. When FLAG = "PENDING", it reads inputs, processes the lookup, writes results
 * 4. Sets FLAG to "COMPLETE" when done
 */

const microsoftGraphExcelService = require('./microsoft-graph-excel.service');
const excelLookupService = require('./excel-lookup.service');
const { Client } = require('@microsoft/microsoft-graph-client');
const microsoftAuthService = require('./microsoft-auth.service');
const debugConfig = require('./debug-config.service');

class ExcelPollingService {
    constructor() {
        this.isPolling = false;
        this.pollInterval = null;
        this.pollIntervalMs = 5000; // Check every 5 seconds
        this.config = null;
        this.stats = {
            startedAt: null,
            lastPollAt: null,
            pollCount: 0,
            requestsProcessed: 0,
            errors: 0,
            lastError: null
        };
        
        // Cell locations in the Lookup sheet
        this.cells = {
            flag: 'B8',          // FLAG cell: "Pull Data" triggers lookup, "Completed" when done
            tenantInput: 'B2',   // Tenant name/ID input
            psRecordInput: 'B3', // PS Record input (optional)
            forceFresh: 'B4',    // Force Fresh input (YES/NO)
            status: 'D2',        // Status output
            error: 'D3',         // Error message output
            timestamp: 'D4',     // Timestamp output
            requestedBy: 'B5',   // Who requested (optional, for tracking)
        };
        
        // Flag values
        this.flagValues = {
            trigger: 'Pull Data',    // Value that triggers a lookup
            processing: 'Processing...',
            complete: 'Completed',
            error: 'Error'
        };
        
        // Debug logger
        this.log = debugConfig.logger('excel-polling');
    }

    /**
     * Get Graph API client
     */
    async getGraphClient() {
        const tokenResult = await microsoftAuthService.getAccessToken();
        if (!tokenResult.success) {
            throw new Error(tokenResult.error || 'Failed to get access token');
        }

        return Client.init({
            authProvider: (done) => {
                done(null, tokenResult.accessToken);
            }
        });
    }

    /**
     * Get current polling status
     */
    getStatus() {
        return {
            isPolling: this.isPolling,
            pollIntervalMs: this.pollIntervalMs,
            config: this.config ? {
                fileName: this.config.fileName,
                driveId: this.config.driveId ? '***configured***' : null,
                itemId: this.config.itemId ? '***configured***' : null
            } : null,
            stats: this.stats
        };
    }

    /**
     * Configure the Excel file to poll
     */
    async configure(shareUrl) {
        try {
            this.log('🔧 Configuring Excel polling for:', shareUrl);
            
            // Resolve the share link to get file info
            const result = await microsoftGraphExcelService.resolveShareLink(shareUrl);
            
            if (!result.success) {
                return { success: false, error: result.error };
            }

            this.config = {
                driveId: result.file.driveId,
                itemId: result.file.id,
                fileName: result.file.name,
                shareUrl: shareUrl,
                configuredAt: new Date().toISOString()
            };

            this.log('✅ Excel polling configured for:', this.config.fileName);
            
            return { 
                success: true, 
                message: `Configured polling for "${this.config.fileName}"`,
                config: {
                    fileName: this.config.fileName
                }
            };
        } catch (error) {
            console.error('❌ Error configuring Excel polling:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Start polling the Excel file
     */
    async start() {
        if (this.isPolling) {
            return { success: false, error: 'Polling is already running' };
        }

        if (!this.config) {
            // Try to load from saved config
            const savedConfig = microsoftGraphExcelService.getConfig();
            if (savedConfig.driveId && savedConfig.itemId) {
                this.config = {
                    driveId: savedConfig.driveId,
                    itemId: savedConfig.itemId,
                    fileName: savedConfig.fileName || 'Unknown'
                };
            } else {
                return { success: false, error: 'No Excel file configured. Please configure first.' };
            }
        }

        this.log('▶️ Starting Excel polling for:', this.config.fileName);
        
        this.isPolling = true;
        this.stats.startedAt = new Date().toISOString();
        this.stats.pollCount = 0;
        
        // Start the polling loop
        this.pollInterval = setInterval(() => this.poll(), this.pollIntervalMs);
        
        // Do an immediate poll
        this.poll();

        return { 
            success: true, 
            message: `Started polling "${this.config.fileName}" every ${this.pollIntervalMs/1000} seconds`
        };
    }

    /**
     * Stop polling
     */
    stop() {
        if (!this.isPolling) {
            return { success: false, error: 'Polling is not running' };
        }

        this.log('⏹️ Stopping Excel polling');
        
        clearInterval(this.pollInterval);
        this.pollInterval = null;
        this.isPolling = false;

        return { 
            success: true, 
            message: 'Polling stopped',
            stats: this.stats
        };
    }

    /**
     * Single poll iteration - check for pending requests
     */
    async poll() {
        if (!this.isPolling || !this.config) return;

        this.stats.pollCount++;
        this.stats.lastPollAt = new Date().toISOString();

        try {
            const client = await this.getGraphClient();
            const { driveId, itemId } = this.config;
            const baseUrl = `/drives/${driveId}/items/${itemId}/workbook/worksheets/Lookup`;

            // Read the FLAG cell
            // Add timestamp to bypass any potential caching
            this.log(`   Polling ${this.config.fileName}, checking cell ${this.cells.flag}...`);
            
            const flagResponse = await client.api(`${baseUrl}/range(address='${this.cells.flag}')`)
                .header('Cache-Control', 'no-cache')
                .get();
            
            const flagValue = (flagResponse.values?.[0]?.[0] || '').toString().trim();
            
            // Log every poll for debugging (can be removed later)
            if (this.stats.pollCount % 10 === 1 || flagValue) {
                this.log(`   Poll #${this.stats.pollCount}: Cell ${this.cells.flag} = "${flagValue}"`);
            }

            // Check if flag matches trigger value (case-insensitive)
            if (flagValue.toLowerCase() === this.flagValues.trigger.toLowerCase()) {
                this.log('📥 Found "Pull Data" request, processing...');
                await this.processRequest(client, baseUrl);
            }
            // If not trigger value, do nothing - just wait for next poll
            
        } catch (error) {
            this.stats.errors++;
            this.stats.lastError = {
                message: error.message,
                at: new Date().toISOString()
            };
            
            // Log all errors for debugging
            console.error(`❌ Polling error (poll #${this.stats.pollCount}):`, error.message);
            
            // Log more details for common issues
            if (error.message.includes('Worksheet')) {
                console.error('   Hint: Make sure the Excel file has a sheet named "Lookup"');
            }
            if (error.message.includes('token') || error.message.includes('auth')) {
                console.error('   Hint: Microsoft Graph authentication may have expired');
            }
        }
    }

    /**
     * Process a pending lookup request
     */
    async processRequest(client, baseUrl) {
        try {
            // Set FLAG to PROCESSING
            await this.writeCell(client, baseUrl, this.cells.flag, this.flagValues.processing);
            await this.writeCell(client, baseUrl, this.cells.status, 'Processing...');
            await this.writeCell(client, baseUrl, this.cells.timestamp, new Date().toISOString());

            // Read inputs
            const tenantInput = await this.readCell(client, baseUrl, this.cells.tenantInput);
            const psRecordInput = await this.readCell(client, baseUrl, this.cells.psRecordInput);
            const forceFreshInput = await this.readCell(client, baseUrl, this.cells.forceFresh);

            const tenantNameOrId = (tenantInput || '').trim();
            const psRecordName = (psRecordInput || '').trim();
            const forceFresh = (forceFreshInput || '').toUpperCase() === 'YES';

            this.log(`   Tenant: ${tenantNameOrId}`);
            this.log(`   PS Record: ${psRecordName || '(none)'}`);
            this.log(`   Force Fresh: ${forceFresh}`);

            if (!tenantNameOrId) {
                await this.writeError(client, baseUrl, 'Tenant name/ID is required');
                return;
            }

            // Perform the lookup
            let result;
            if (psRecordName) {
                result = await excelLookupService.compareWithPSRecord(tenantNameOrId, psRecordName, forceFresh);
            } else {
                result = await excelLookupService.lookupTenant(tenantNameOrId, forceFresh);
            }

            // Format for Excel
            const excelFormatted = excelLookupService.formatForExcel(result);

            // Write results to Excel
            try {
                await this.writeResults(client, excelFormatted);
            } catch (writeError) {
                console.error('   Error writing results:', writeError.message);
            }
            
            // Write summary to Lookup sheet if comparison was done
            if (excelFormatted.summary) {
                try {
                    await this.writeSummary(client, baseUrl, excelFormatted.summary);
                } catch (summaryError) {
                    console.error('   Error writing summary:', summaryError.message);
                }
            }

            // Update status - always try to update status regardless of earlier errors
            this.log('   Updating status and flag...');
            try {
                if (excelFormatted.success) {
                    await this.writeCell(client, baseUrl, this.cells.status, 'Success');
                    await this.writeCell(client, baseUrl, this.cells.error, '');
                } else {
                    await this.writeCell(client, baseUrl, this.cells.status, 'Error');
                    await this.writeCell(client, baseUrl, this.cells.error, excelFormatted.error || 'Unknown error');
                }

                // Set FLAG to Completed
                await this.writeCell(client, baseUrl, this.cells.flag, this.flagValues.complete);
                await this.writeCell(client, baseUrl, this.cells.timestamp, new Date().toISOString());
                this.log('   ✅ Status and flag updated');
            } catch (statusError) {
                console.error('   ❌ Error updating status/flag:', statusError.message);
            }

            this.stats.requestsProcessed++;
            this.log('✅ Request processed successfully');

        } catch (error) {
            console.error('❌ Error processing request:', error);
            await this.writeError(client, baseUrl, error.message);
            this.stats.errors++;
            this.stats.lastError = {
                message: error.message,
                at: new Date().toISOString()
            };
        }
    }

    /**
     * Write error state
     */
    async writeError(client, baseUrl, errorMessage) {
        try {
            await this.writeCell(client, baseUrl, this.cells.flag, this.flagValues.error);
            await this.writeCell(client, baseUrl, this.cells.status, 'Error');
            await this.writeCell(client, baseUrl, this.cells.error, errorMessage);
            await this.writeCell(client, baseUrl, this.cells.timestamp, new Date().toISOString());
        } catch (e) {
            console.error('Could not write error state:', e.message);
        }
    }

    /**
     * Read a single cell value
     */
    async readCell(client, baseUrl, cellAddress) {
        try {
            const response = await client.api(`${baseUrl}/range(address='${cellAddress}')`).get();
            return response.values?.[0]?.[0] || '';
        } catch (error) {
            console.error(`Error reading cell ${cellAddress}:`, error.message);
            return '';
        }
    }

    /**
     * Write a single cell value
     */
    async writeCell(client, baseUrl, cellAddress, value) {
        try {
            await client.api(`${baseUrl}/range(address='${cellAddress}')`)
                .patch({ values: [[value]] });
        } catch (error) {
            console.error(`Error writing cell ${cellAddress}:`, error.message);
        }
    }

    /**
     * Write results to the Lookup sheet (SML Entitlements starting at row 16) and Comparison sheet
     */
    async writeResults(client, excelFormatted) {
        const { driveId, itemId } = this.config;
        
        // Write SML Entitlements to Lookup sheet starting at row 16
        if (excelFormatted.smlEntitlements && excelFormatted.smlEntitlements.length > 0) {
            const smlRows = excelFormatted.smlEntitlements.map(e => [
                e.productCode || '',
                e.type || '',
                e.packageName || '',
                e.startDate || '',
                e.endDate || '',
                e.quantity || '',
                e.productModifier || ''
            ]);
            
            await this.writeSMLEntitlementsToLookup(client, driveId, itemId, smlRows);
        }

        // Write Comparison to separate sheet (still needed for detailed comparison)
        if (excelFormatted.comparison && excelFormatted.comparison.length > 0) {
            const comparisonRows = excelFormatted.comparison.map(c => [
                c.productCode || '',
                c.type || '',
                c.status || '',
                c.smlStartDate || '',
                c.smlEndDate || '',
                c.smlPackage || '',
                c.psStartDate || '',
                c.psEndDate || '',
                c.psPackage || '',
                c.notes || ''
            ]);
            
            await this.writeSheet(client, driveId, itemId, 'Comparison',
                ['Product Code', 'Type', 'Status', 'SML Start', 'SML End', 'SML Package', 'PS Start', 'PS End', 'PS Package', 'Notes'],
                comparisonRows
            );
        }
    }
    
    /**
     * Write SML Entitlements to the Lookup sheet starting at row 16
     */
    async writeSMLEntitlementsToLookup(client, driveId, itemId, smlRows) {
        try {
            this.log(`   Writing ${smlRows.length} SML entitlements to Lookup sheet (starting row 16)...`);
            const baseUrl = `/drives/${driveId}/items/${itemId}/workbook/worksheets/Lookup`;
            
            // Clear any existing data in the SML entitlements area (A16:G500)
            try {
                // Use 'Contents' to clear values only, preserving cell formatting
                await client.api(`${baseUrl}/range(address='A16:G500')/clear`)
                    .post({ applyTo: 'Contents' });
            } catch (e) {
                // May not have data to clear
            }
            
            // Prepare data with header
            const headers = ['Product Code', 'Type', 'Package Name', 'Start Date', 'End Date', 'Quantity', 'Modifier'];
            const allData = [headers, ...smlRows];
            const numRows = allData.length;
            const numCols = headers.length;
            
            // Calculate range (starting at row 16)
            const startRow = 16;
            const endRow = startRow + numRows - 1;
            const endColumn = 'G'; // 7 columns
            const rangeAddress = `A${startRow}:${endColumn}${endRow}`;
            
            this.log(`   Writing range: ${rangeAddress}`);
            
            // Write data
            await client.api(`${baseUrl}/range(address='${rangeAddress}')`)
                .patch({ values: allData });
            
            // Format header row (row 16)
            try {
                await client.api(`${baseUrl}/range(address='A16:G16')/format/font`)
                    .patch({ bold: true });
                await client.api(`${baseUrl}/range(address='A16:G16')/format/fill`)
                    .patch({ color: '#4472C4' });
                this.log(`   ✅ Formatted SML header row`);
            } catch (e) {
                this.log(`   Could not format header: ${e.message}`);
            }
            
            this.log(`   ✅ Wrote ${smlRows.length} SML entitlements to Lookup sheet`);
            
        } catch (error) {
            console.error(`   ❌ Error writing SML entitlements to Lookup:`, error.message);
        }
    }
    
    /**
     * Apply color coding to comparison rows based on status
     * Note: Skipped for polling - too slow via Graph API. Use Excel conditional formatting instead.
     */
    async applyComparisonColors(client, driveId, itemId, comparison) {
        // Skip color coding via Graph API - it's too slow for many rows
        // Users should use Excel conditional formatting for color coding
        this.log(`   Skipping color coding (use Excel conditional formatting instead)`);
        return;
    }

    /**
     * Write summary statistics to the Lookup sheet (F2:G6)
     */
    async writeSummary(client, baseUrl, summary) {
        try {
            this.log('   Writing summary to Lookup sheet...');
            
            // F2:G6 - Summary statistics
            const summaryData = [
                ['In SF Only (Adding):', summary.inSFOnly || 0],
                ['In SML Only (Removing):', summary.inSMLOnly || 0],
                ['Different:', summary.different || 0],
                ['Matching:', summary.matching || 0],
                ['Overall:', summary.hasDiscrepancies ? 'Has Discrepancies' : 'All Match']
            ];
            
            // Write the summary data
            await client.api(`${baseUrl}/range(address='F2:G6')`)
                .patch({ values: summaryData });
            
            // Format cells with colors
            try {
                // F2:G2 - Green for "In SF Only"
                await client.api(`${baseUrl}/range(address='G2')/format/fill`)
                    .patch({ color: '#C6EFCE' });
                
                // F3:G3 - Red for "In SML Only"
                await client.api(`${baseUrl}/range(address='G3')/format/fill`)
                    .patch({ color: '#FFC7CE' });
                
                // F4:G4 - Yellow for "Different"
                await client.api(`${baseUrl}/range(address='G4')/format/fill`)
                    .patch({ color: '#FFEB9C' });
                
                // F5:G5 - Blue for "Matching"
                await client.api(`${baseUrl}/range(address='G5')/format/fill`)
                    .patch({ color: '#BDD7EE' });
                
                // F6:G6 - Bold and color based on discrepancies
                await client.api(`${baseUrl}/range(address='G6')/format/font`)
                    .patch({ 
                        bold: true,
                        color: summary.hasDiscrepancies ? '#C00000' : '#008000'
                    });
                    
                this.log('   ✅ Summary written with formatting');
            } catch (formatError) {
                this.log(`   Summary written but formatting failed: ${formatError.message}`);
            }
            
        } catch (error) {
            console.error('   Error writing summary:', error.message);
        }
    }

    /**
     * Write data to a sheet (clear and rewrite)
     */
    async writeSheet(client, driveId, itemId, sheetName, headers, rows) {
        try {
            this.log(`   Writing to sheet: ${sheetName} (${rows.length} rows)`);
            
            const baseUrl = `/drives/${driveId}/items/${itemId}/workbook/worksheets/${encodeURIComponent(sheetName)}`;

            // Try to get the sheet, create if doesn't exist
            try {
                await client.api(baseUrl).get();
                this.log(`   Sheet "${sheetName}" exists`);
            } catch (e) {
                // Sheet doesn't exist, create it
                this.log(`   Creating sheet: ${sheetName}`);
                await client.api(`/drives/${driveId}/items/${itemId}/workbook/worksheets`)
                    .post({ name: sheetName });
                this.log(`   Created sheet: ${sheetName}`);
            }

            // Clear existing content
            try {
                const usedRange = await client.api(`${baseUrl}/usedRange`).get();
                if (usedRange && usedRange.address) {
                    // Extract just the cell range (remove sheet name prefix like "'Sheet Name'!")
                    let rangeOnly = usedRange.address;
                    if (rangeOnly.includes('!')) {
                        rangeOnly = rangeOnly.split('!')[1];
                    }
                    this.log(`   Clearing existing range: ${rangeOnly}`);
                    // Use 'Contents' to clear values only, preserving cell formatting
                    await client.api(`${baseUrl}/range(address='${rangeOnly}')/clear`)
                        .post({ applyTo: 'Contents' });
                }
            } catch (e) {
                this.log(`   Sheet is empty or could not clear: ${e.message}`);
            }

            // Sanitize data - convert all values to strings or numbers, handle nulls
            const sanitizeValue = (val) => {
                if (val === null || val === undefined) return '';
                if (typeof val === 'object') return JSON.stringify(val);
                return val;
            };

            const sanitizedRows = rows.map(row => 
                row.map(cell => sanitizeValue(cell))
            );

            // Prepare data
            const allData = [headers, ...sanitizedRows];
            const numRows = allData.length;
            const numCols = headers.length;

            const getColumnLetter = (num) => {
                let letter = '';
                while (num > 0) {
                    const remainder = (num - 1) % 26;
                    letter = String.fromCharCode(65 + remainder) + letter;
                    num = Math.floor((num - 1) / 26);
                }
                return letter;
            };

            const endColumn = getColumnLetter(numCols);
            const rangeAddress = `A1:${endColumn}${numRows}`;
            
            this.log(`   Writing range: ${rangeAddress}`);
            this.log(`   Sample row: ${JSON.stringify(sanitizedRows[0])}`);

            // Write data
            await client.api(`${baseUrl}/range(address='${rangeAddress}')`)
                .patch({ values: allData });

            // Format header row
            try {
                // First make it bold
                await client.api(`${baseUrl}/range(address='A1:${endColumn}1')/format/font`)
                    .patch({ bold: true });
                
                // Then set background color
                await client.api(`${baseUrl}/range(address='A1:${endColumn}1')/format/fill`)
                    .patch({ color: '#4472C4' });
                    
                this.log(`   ✅ Formatted header row`);
            } catch (e) {
                // Formatting is optional
                this.log(`   Could not format header: ${e.message}`);
            }

            this.log(`   ✅ Wrote ${rows.length} rows to ${sheetName}`);

        } catch (error) {
            console.error(`   ❌ Error writing to ${sheetName}:`, error.message);
            if (error.body) {
                try {
                    const errorBody = JSON.parse(error.body);
                    console.error(`   Error details:`, JSON.stringify(errorBody, null, 2));
                } catch (e) {
                    console.error(`   Error body:`, error.body);
                }
            }
        }
    }

    /**
     * Set polling interval
     */
    setInterval(intervalMs) {
        if (intervalMs < 1000 || intervalMs > 60000) {
            return { success: false, error: 'Interval must be between 1000ms and 60000ms' };
        }

        this.pollIntervalMs = intervalMs;

        // If currently polling, restart with new interval
        if (this.isPolling) {
            clearInterval(this.pollInterval);
            this.pollInterval = setInterval(() => this.poll(), this.pollIntervalMs);
        }

        return { 
            success: true, 
            message: `Polling interval set to ${intervalMs}ms`
        };
    }
}

module.exports = new ExcelPollingService();
