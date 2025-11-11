/**
 * Excel Builder Utility
 * Provides utilities for creating Excel files with consistent styling
 */

const ExcelJS = require('exceljs');

/**
 * Default header style for Excel sheets
 */
const defaultHeaderStyle = {
    font: { 
        bold: true, 
        color: { argb: 'FFFFFFFF' }, 
        size: 11 
    },
    fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
    },
    alignment: { 
        vertical: 'middle', 
        horizontal: 'center',
        wrapText: true
    },
    border: {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
    }
};

/**
 * Default cell style for Excel sheets
 */
const defaultCellStyle = {
    alignment: { 
        vertical: 'top',
        wrapText: true
    },
    border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    }
};

/**
 * Create a new workbook
 * @returns {ExcelJS.Workbook} New workbook instance
 */
function createWorkbook() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DeployAssist';
    workbook.created = new Date();
    workbook.modified = new Date();
    return workbook;
}

/**
 * Add a worksheet with title
 * @param {ExcelJS.Workbook} workbook - Workbook instance
 * @param {String} sheetName - Name of the worksheet
 * @param {String} title - Title for the sheet
 * @param {Object} options - Additional options
 * @returns {ExcelJS.Worksheet} Created worksheet
 */
function addWorksheetWithTitle(workbook, sheetName, title, options = {}) {
    const sheet = workbook.addWorksheet(sheetName, {
        views: [{ state: 'frozen', xSplit: 0, ySplit: options.freezeRow || 1 }],
        ...options.worksheetOptions
    });
    
    // Add title row
    if (title) {
        const titleColSpan = options.titleColSpan || 5;
        sheet.mergeCells(1, 1, 1, titleColSpan);
        const titleCell = sheet.getCell(1, 1);
        titleCell.value = title;
        titleCell.font = { bold: true, size: 14, color: { argb: 'FF000000' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE7E6E6' }
        };
        sheet.getRow(1).height = 25;
    }
    
    return sheet;
}

/**
 * Add metadata row to worksheet
 * @param {ExcelJS.Worksheet} sheet - Worksheet instance
 * @param {Number} rowNumber - Row number
 * @param {Object} metadata - Metadata key-value pairs
 */
function addMetadataRow(sheet, rowNumber, metadata) {
    let col = 1;
    Object.entries(metadata).forEach(([key, value]) => {
        sheet.getCell(rowNumber, col).value = `${key}: ${value}`;
        sheet.getCell(rowNumber, col).font = { italic: true };
        col++;
    });
}

/**
 * Add headers to worksheet
 * @param {ExcelJS.Worksheet} sheet - Worksheet instance
 * @param {Number} rowNumber - Row number for headers
 * @param {Array} headers - Array of header names
 * @param {Object} customStyle - Custom header style
 */
function addHeaders(sheet, rowNumber, headers, customStyle = {}) {
    const headerStyle = { ...defaultHeaderStyle, ...customStyle };
    const row = sheet.getRow(rowNumber);
    row.values = headers;
    row.eachCell((cell) => {
        cell.style = headerStyle;
    });
    row.height = 30;
}

/**
 * Add data rows to worksheet
 * @param {ExcelJS.Worksheet} sheet - Worksheet instance
 * @param {Number} startRow - Starting row number
 * @param {Array} data - Array of data rows
 * @param {Object} customStyle - Custom cell style
 * @returns {Number} Last row number
 */
function addDataRows(sheet, startRow, data, customStyle = {}) {
    const cellStyle = { ...defaultCellStyle, ...customStyle };
    
    data.forEach((rowData, idx) => {
        const rowNum = startRow + idx;
        const row = sheet.getRow(rowNum);
        row.values = rowData;
        row.eachCell((cell) => {
            cell.style = cellStyle;
        });
    });
    
    return startRow + data.length - 1;
}

/**
 * Auto-fit columns based on content
 * @param {ExcelJS.Worksheet} sheet - Worksheet instance
 * @param {Number} minWidth - Minimum column width
 * @param {Number} maxWidth - Maximum column width
 */
function autoFitColumns(sheet, minWidth = 10, maxWidth = 50) {
    sheet.columns.forEach(column => {
        let maxLength = minWidth;
        column.eachCell({ includeEmpty: true }, cell => {
            const cellValue = cell.value ? cell.value.toString() : '';
            maxLength = Math.max(maxLength, cellValue.length);
        });
        column.width = Math.min(maxLength + 2, maxWidth);
    });
}

/**
 * Set column widths
 * @param {ExcelJS.Worksheet} sheet - Worksheet instance
 * @param {Array} widths - Array of column widths
 */
function setColumnWidths(sheet, widths) {
    sheet.columns = widths.map(width => ({ width }));
}

/**
 * Add alternating row colors
 * @param {ExcelJS.Worksheet} sheet - Worksheet instance
 * @param {Number} startRow - Starting row
 * @param {Number} endRow - Ending row
 * @param {String} color1 - First color (ARGB format)
 * @param {String} color2 - Second color (ARGB format)
 */
function addAlternatingRowColors(sheet, startRow, endRow, color1 = 'FFFFFFFF', color2 = 'FFF2F2F2') {
    for (let i = startRow; i <= endRow; i++) {
        const row = sheet.getRow(i);
        const color = (i - startRow) % 2 === 0 ? color1 : color2;
        row.eachCell((cell) => {
            if (!cell.fill || cell.fill.type === 'none') {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: color }
                };
            }
        });
    }
}

/**
 * Add summary section to worksheet
 * @param {ExcelJS.Worksheet} sheet - Worksheet instance
 * @param {Number} startRow - Starting row
 * @param {String} title - Section title
 * @param {Object} summaryData - Key-value pairs for summary
 * @returns {Number} Last row number
 */
function addSummarySection(sheet, startRow, title, summaryData) {
    // Add section title
    sheet.getCell(startRow, 1).value = title;
    sheet.getCell(startRow, 1).font = { bold: true, size: 12 };
    startRow++;
    
    // Add summary rows
    Object.entries(summaryData).forEach(([key, value]) => {
        sheet.getCell(startRow, 1).value = key;
        sheet.getCell(startRow, 1).font = { bold: true };
        sheet.getCell(startRow, 2).value = value;
        startRow++;
    });
    
    return startRow;
}

/**
 * Protect worksheet
 * @param {ExcelJS.Worksheet} sheet - Worksheet instance
 * @param {String} password - Protection password
 * @param {Object} options - Protection options
 */
function protectSheet(sheet, password, options = {}) {
    sheet.protect(password, {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertRows: false,
        insertColumns: false,
        deleteRows: false,
        deleteColumns: false,
        sort: false,
        autoFilter: false,
        pivotTables: false,
        ...options
    });
}

/**
 * Write workbook to buffer
 * @param {ExcelJS.Workbook} workbook - Workbook instance
 * @returns {Promise<Buffer>} Excel file buffer
 */
async function writeToBuffer(workbook) {
    return await workbook.xlsx.writeBuffer();
}

/**
 * Write workbook to file
 * @param {ExcelJS.Workbook} workbook - Workbook instance
 * @param {String} filePath - File path
 * @returns {Promise<void>}
 */
async function writeToFile(workbook, filePath) {
    await workbook.xlsx.writeFile(filePath);
}

/**
 * Create simple table worksheet
 * @param {ExcelJS.Workbook} workbook - Workbook instance
 * @param {String} sheetName - Name of the worksheet
 * @param {String} title - Sheet title
 * @param {Array} headers - Column headers
 * @param {Array} data - Data rows
 * @param {Object} options - Additional options
 * @returns {ExcelJS.Worksheet} Created worksheet
 */
function createSimpleTable(workbook, sheetName, title, headers, data, options = {}) {
    const sheet = addWorksheetWithTitle(workbook, sheetName, title, {
        freezeRow: 4,
        titleColSpan: headers.length,
        ...options
    });
    
    // Add metadata if provided
    if (options.metadata) {
        addMetadataRow(sheet, 2, options.metadata);
    }
    
    // Add headers
    const headerRow = options.metadata ? 4 : 3;
    addHeaders(sheet, headerRow, headers, options.headerStyle);
    
    // Add data
    addDataRows(sheet, headerRow + 1, data, options.cellStyle);
    
    // Auto-fit or set column widths
    if (options.columnWidths) {
        setColumnWidths(sheet, options.columnWidths);
    } else {
        autoFitColumns(sheet, options.minColWidth, options.maxColWidth);
    }
    
    // Add alternating colors if enabled
    if (options.alternatingColors !== false) {
        addAlternatingRowColors(sheet, headerRow + 1, headerRow + data.length);
    }
    
    return sheet;
}

module.exports = {
    // Core functions
    createWorkbook,
    writeToBuffer,
    writeToFile,
    
    // Worksheet functions
    addWorksheetWithTitle,
    addMetadataRow,
    addHeaders,
    addDataRows,
    addSummarySection,
    
    // Styling functions
    autoFitColumns,
    setColumnWidths,
    addAlternatingRowColors,
    protectSheet,
    
    // High-level functions
    createSimpleTable,
    
    // Style constants
    defaultHeaderStyle,
    defaultCellStyle
};

