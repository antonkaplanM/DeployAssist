/**
 * Excel Service
 * Handles reading and writing Excel files for Current Accounts export
 */

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// Config file path for storing Excel settings
const CONFIG_FILE = path.join(__dirname, '..', 'config', 'excel-config.json');

class ExcelService {
    constructor() {
        this.ensureConfigDir();
    }

    /**
     * Ensure the config directory exists
     */
    ensureConfigDir() {
        const configDir = path.dirname(CONFIG_FILE);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
    }

    /**
     * Get the current Excel configuration
     */
    getConfig() {
        try {
            if (fs.existsSync(CONFIG_FILE)) {
                const data = fs.readFileSync(CONFIG_FILE, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error reading Excel config:', error);
        }
        return {
            filePath: '',
            sheetName: '',
            lastUpdated: null
        };
    }

    /**
     * Save the Excel configuration
     */
    saveConfig(config) {
        try {
            const currentConfig = this.getConfig();
            const newConfig = {
                ...currentConfig,
                ...config,
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
            return { success: true, config: newConfig };
        } catch (error) {
            console.error('Error saving Excel config:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if a file exists and is accessible
     */
    async validateFilePath(filePath) {
        try {
            // Normalize the path
            const normalizedPath = path.normalize(filePath);
            
            // Check if file exists
            if (!fs.existsSync(normalizedPath)) {
                return { 
                    valid: false, 
                    exists: false,
                    error: 'File does not exist at the specified path' 
                };
            }

            // Check if it's an xlsx file
            const ext = path.extname(normalizedPath).toLowerCase();
            if (ext !== '.xlsx') {
                return { 
                    valid: false, 
                    exists: true,
                    error: 'File must be an .xlsx file' 
                };
            }

            // Try to read the file to verify access
            await fs.promises.access(normalizedPath, fs.constants.R_OK | fs.constants.W_OK);

            return { 
                valid: true, 
                exists: true,
                path: normalizedPath 
            };
        } catch (error) {
            return { 
                valid: false, 
                exists: false,
                error: `Cannot access file: ${error.message}` 
            };
        }
    }

    /**
     * Get list of sheets from an Excel file
     */
    async getSheets(filePath) {
        try {
            const normalizedPath = path.normalize(filePath);
            
            if (!fs.existsSync(normalizedPath)) {
                return { success: false, error: 'File does not exist' };
            }

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(normalizedPath);

            const sheets = workbook.worksheets.map(sheet => ({
                name: sheet.name,
                rowCount: sheet.rowCount,
                columnCount: sheet.columnCount
            }));

            return { success: true, sheets };
        } catch (error) {
            console.error('Error reading sheets:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Create a new Excel file with Current Accounts data
     */
    async createExcelFile(filePath, sheetName, accounts) {
        try {
            const normalizedPath = path.normalize(filePath);
            
            // Ensure directory exists
            const dir = path.dirname(normalizedPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'DeployAssist';
            workbook.created = new Date();

            const worksheet = workbook.addWorksheet(sheetName);
            
            // Add headers and data
            this._populateWorksheet(worksheet, accounts);

            // Save the file
            await workbook.xlsx.writeFile(normalizedPath);

            // Update config
            this.saveConfig({ filePath: normalizedPath, sheetName });

            return { 
                success: true, 
                message: `Created new Excel file with ${accounts.length} records`,
                filePath: normalizedPath,
                sheetName
            };
        } catch (error) {
            console.error('Error creating Excel file:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update an existing Excel file's sheet with Current Accounts data
     */
    async updateExcelFile(filePath, sheetName, accounts) {
        try {
            const normalizedPath = path.normalize(filePath);
            
            if (!fs.existsSync(normalizedPath)) {
                return { success: false, error: 'File does not exist' };
            }

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(normalizedPath);

            // Find and remove the existing sheet
            const existingSheet = workbook.getWorksheet(sheetName);
            if (existingSheet) {
                workbook.removeWorksheet(existingSheet.id);
            }

            // Create new sheet with the same name
            const worksheet = workbook.addWorksheet(sheetName);
            
            // Add headers and data
            this._populateWorksheet(worksheet, accounts);

            // Save the file
            await workbook.xlsx.writeFile(normalizedPath);

            // Update config
            this.saveConfig({ filePath: normalizedPath, sheetName });

            return { 
                success: true, 
                message: `Updated sheet "${sheetName}" with ${accounts.length} records`,
                filePath: normalizedPath,
                sheetName
            };
        } catch (error) {
            console.error('Error updating Excel file:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Populate a worksheet with Current Accounts data
     * Columns match what is published to Confluence
     */
    _populateWorksheet(worksheet, accounts) {
        // Define columns (matching Confluence)
        const columns = [
            { header: 'Client', key: 'client', width: 30 },
            { header: 'Services', key: 'services', width: 25 },
            { header: 'Type', key: 'account_type', width: 15 },
            { header: 'CSM/Owner', key: 'csm_owner', width: 20 },
            { header: 'PS Record', key: 'ps_record_name', width: 20 },
            { header: 'Completed', key: 'completion_date', width: 15 },
            { header: 'Size', key: 'size', width: 10 },
            { header: 'Region', key: 'region', width: 10 },
            { header: 'Tenant', key: 'tenant_name', width: 25 },
            { header: 'Tenant ID', key: 'tenant_id', width: 15 },
            { header: 'SF Account ID', key: 'salesforce_account_id', width: 20 },
            { header: 'Tenant URL', key: 'tenant_url', width: 40 },
            { header: 'Admin', key: 'initial_tenant_admin', width: 30 },
            { header: 'Comments', key: 'comments', width: 40 }
        ];

        worksheet.columns = columns;

        // Style the header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Add data rows
        accounts.forEach(account => {
            const row = {
                client: account.client || '—',
                services: account.services || '—',
                account_type: account.account_type || '—',
                csm_owner: account.csm_owner || '—',
                ps_record_name: account.ps_record_name || '—',
                completion_date: account.completion_date 
                    ? new Date(account.completion_date).toLocaleDateString() 
                    : '—',
                size: account.size || '—',
                region: account.region || '—',
                tenant_name: account.tenant_name || '—',
                tenant_id: account.tenant_id || '—',
                salesforce_account_id: account.salesforce_account_id || '—',
                tenant_url: account.tenant_url || '—',
                initial_tenant_admin: account.initial_tenant_admin || '—',
                comments: account.comments || ''
            };
            worksheet.addRow(row);
        });

        // Add filters to header row
        worksheet.autoFilter = {
            from: 'A1',
            to: `N${accounts.length + 1}`
        };

        // Freeze the header row
        worksheet.views = [
            { state: 'frozen', ySplit: 1 }
        ];
    }
}

module.exports = new ExcelService();
