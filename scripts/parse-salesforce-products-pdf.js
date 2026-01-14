/**
 * Parse Salesforce Products PDF and Create Excel Spreadsheet
 * 
 * This script parses the "All Products ~ MA Salesforce.pdf" file
 * and creates an Excel spreadsheet with the extracted product data.
 * 
 * Usage: node scripts/parse-salesforce-products-pdf.js
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// Configuration
const PDF_PATH = path.join(__dirname, '..', 'docs', 'data', 'All Products ~ MA Salesforce.pdf');
const OUTPUT_PATH = path.join(__dirname, '..', 'docs', 'data', 'All_Products_MA_Salesforce.xlsx');

/**
 * Parse the PDF using pdfjs-dist
 */
async function parsePDF() {
    console.log('Loading PDF library...');
    
    // Load pdfjs-dist
    const pdfjsLib = require('pdfjs-dist/build/pdf.js');
    
    console.log('Reading PDF file...');
    const data = new Uint8Array(fs.readFileSync(PDF_PATH));
    
    console.log('Parsing PDF...');
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    
    console.log(`PDF has ${pdf.numPages} pages`);
    
    let fullText = '';
    
    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Get text items with position info for grouping by rows
        const items = textContent.items.filter(item => item.str);
        
        // Group items by Y position (same row)
        const rowMap = new Map();
        for (const item of items) {
            const y = Math.round(item.transform[5]);
            if (!rowMap.has(y)) {
                rowMap.set(y, []);
            }
            rowMap.get(y).push({
                text: item.str,
                x: item.transform[4]
            });
        }
        
        // Sort rows by Y (descending for PDF coordinate system)
        const sortedRows = Array.from(rowMap.entries())
            .sort((a, b) => b[0] - a[0]);
        
        // Build page text row by row
        for (const [y, rowItems] of sortedRows) {
            // Sort items within row by X position
            rowItems.sort((a, b) => a.x - b.x);
            const rowText = rowItems.map(i => i.text).join('   ');
            fullText += rowText + '\n';
        }
        
        fullText += '\n';
    }
    
    // Save raw text for debugging
    const debugPath = path.join(__dirname, '..', 'docs', 'data', 'pdf_raw_text.txt');
    fs.writeFileSync(debugPath, fullText);
    console.log(`Raw text saved to: ${debugPath}`);
    
    return fullText;
}

/**
 * Parse products from the extracted text
 * Each product entry ends with a date in M/D/YYYY format
 */
function parseProducts(fullText) {
    const products = [];
    const lines = fullText.split('\n');
    
    // Date pattern at end of line
    const dateEndPattern = /(\d{1,2}\/\d{1,2}\/\d{4})\s*$/;
    
    // Collect lines for each product
    let currentProductLines = [];
    let skipHeaders = true;
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty lines
        if (!trimmed) {
            continue;
        }
        
        // Skip header content until we see the column headers
        if (skipHeaders) {
            if (trimmed.includes('Product Name') && trimmed.includes('Created Date')) {
                skipHeaders = false;
            }
            continue;
        }
        
        // Skip footer content
        if (isFooterLine(trimmed)) {
            continue;
        }
        
        // Add line to current product
        currentProductLines.push(trimmed);
        
        // Check if this line ends with a date (product complete)
        if (dateEndPattern.test(trimmed)) {
            // Parse the collected lines as a product
            const productText = currentProductLines.join(' ');
            const product = parseProductRow(productText);
            
            if (product) {
                products.push(product);
            }
            
            currentProductLines = [];
        }
    }
    
    console.log(`Parsed ${products.length} products`);
    return products;
}

/**
 * Check if a line is footer content to skip
 */
function isFooterLine(line) {
    const footerPatterns = [
        /^\d+\/\d+$/, // Page numbers like "1/36"
        /^https:\/\//,
        /salesforce\.com/i,
        /Copyright/i,
        /^All Products ~ Salesforce/,
        /^\d{1,2}\/\d{1,2}\/\d{2},/  // Date/time header
    ];
    
    return footerPatterns.some(p => p.test(line));
}

/**
 * Parse a product row text into structured data
 */
function parseProductRow(text) {
    // Extract date from the end
    const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*$/);
    if (!dateMatch) return null;
    
    const createdDate = dateMatch[1];
    
    // Remove the date from the text
    let content = text.substring(0, text.lastIndexOf(createdDate)).trim();
    
    // Known divisions (3-4 letter codes)
    const divisions = ['BVD', 'LEW', 'MKMV', 'ISG', 'ERS'];
    
    // L1 Hierarchy values
    const l1Values = [
        'Decision Solutions',
        'Research and Insights',
        'Data and Information',
        'Professional Services'
    ];
    
    // Initialize fields
    let productName = '';
    let division = '';
    let productCode = '';
    let l1Hierarchy = '';
    let l2Hierarchy = '';
    let l3Hierarchy = '';
    let l4Hierarchy = '';
    let l5Hierarchy = '';
    let l6Hierarchy = '';
    let portalProduct = '';
    
    // Find product code (5 digit number)
    const codeMatches = content.match(/\b(\d{5})\b/g);
    if (codeMatches && codeMatches.length > 0) {
        productCode = codeMatches[0];
    }
    
    // Find division
    for (const div of divisions) {
        const divPattern = new RegExp(`\\b${div}\\b`, 'i');
        if (divPattern.test(content)) {
            division = div;
            break;
        }
    }
    
    // Find L1 Hierarchy
    for (const l1 of l1Values) {
        // Handle split L1 (e.g., "Decision Solutions" might appear as "Decision   Solutions")
        const l1Pattern = l1.replace(' ', '\\s+');
        const regex = new RegExp(l1Pattern, 'i');
        if (regex.test(content)) {
            l1Hierarchy = l1;
            break;
        }
    }
    
    // If L1 not found, check for partial matches
    if (!l1Hierarchy) {
        if (/Decision\s+Solutions/i.test(content) || content.includes('Decision') && content.includes('Solutions')) {
            l1Hierarchy = 'Decision Solutions';
        } else if (/Research\s+(and\s+)?Insights/i.test(content) || content.includes('Research') && content.includes('Insights')) {
            l1Hierarchy = 'Research and Insights';
        } else if (/Data\s+(and\s+)?Information/i.test(content) || content.includes('Data') && content.includes('Information')) {
            l1Hierarchy = 'Data and Information';
        }
    }
    
    // Extract product name (before division or product code)
    // The product name is typically at the start
    let nameEnd = content.length;
    
    if (division) {
        const divIndex = content.indexOf(division);
        if (divIndex > 0 && divIndex < nameEnd) {
            nameEnd = divIndex;
        }
    }
    
    if (productCode) {
        const codeIndex = content.indexOf(productCode);
        if (codeIndex > 0 && codeIndex < nameEnd) {
            nameEnd = codeIndex;
        }
    }
    
    productName = content.substring(0, nameEnd).trim();
    
    // Clean up product name
    productName = productName
        .replace(/\s+/g, ' ')
        .replace(/^\s*-\s*/, '')
        .trim();
    
    // Extract the remaining content for hierarchies
    let afterCode = '';
    if (productCode) {
        const codeIndex = content.indexOf(productCode);
        afterCode = content.substring(codeIndex + productCode.length);
    } else if (division) {
        const divIndex = content.indexOf(division);
        afterCode = content.substring(divIndex + division.length);
    } else {
        afterCode = content.substring(productName.length);
    }
    
    // Remove the division from afterCode if it's at the start
    if (division && afterCode.trim().startsWith(division)) {
        afterCode = afterCode.substring(afterCode.indexOf(division) + division.length);
    }
    
    // Parse hierarchies from the remaining text
    // Split by multiple spaces
    const parts = afterCode.split(/\s{2,}/).map(p => p.trim()).filter(p => p);
    
    // Remove known L1 values from parts and assign to l1Hierarchy
    const cleanedParts = [];
    for (const part of parts) {
        let isL1 = false;
        for (const l1 of l1Values) {
            if (part.toLowerCase().includes(l1.toLowerCase()) || 
                (part === 'Decision' || part === 'Solutions' || 
                 part === 'Research' || part === 'Insights' ||
                 part === 'Data' || part === 'Information' ||
                 part === 'and Insights' || part === 'and Information')) {
                isL1 = true;
                break;
            }
        }
        if (!isL1) {
            cleanedParts.push(part);
        }
    }
    
    // Assign remaining parts to hierarchy fields
    if (cleanedParts.length > 0) l2Hierarchy = cleanedParts[0];
    if (cleanedParts.length > 1) l3Hierarchy = cleanedParts[1];
    if (cleanedParts.length > 2) l4Hierarchy = cleanedParts[2];
    if (cleanedParts.length > 3) l5Hierarchy = cleanedParts[3];
    if (cleanedParts.length > 4) l6Hierarchy = cleanedParts[4];
    if (cleanedParts.length > 5) portalProduct = cleanedParts[5];
    
    // Validate product name
    if (!productName || productName.length < 3) {
        return null;
    }
    
    // Skip if product name looks like header content
    if (productName.toLowerCase().includes('product name') ||
        productName.toLowerCase().includes('active (product)')) {
        return null;
    }
    
    return {
        productName,
        active: 'Yes',
        division,
        productCode,
        l1Hierarchy,
        l2Hierarchy,
        l3Hierarchy,
        l4Hierarchy,
        l5Hierarchy,
        l6Hierarchy,
        portalProduct,
        createdDate
    };
}

/**
 * Create Excel spreadsheet from products
 */
async function createExcel(products) {
    console.log(`\nCreating Excel file with ${products.length} products...`);
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Deploy Assist';
    workbook.created = new Date();
    
    // Create main worksheet
    const worksheet = workbook.addWorksheet('All Products');
    
    // Set up columns
    worksheet.columns = [
        { header: 'Product Name', key: 'productName', width: 50 },
        { header: 'Active (Product)', key: 'active', width: 15 },
        { header: 'Division', key: 'division', width: 12 },
        { header: 'Product Code', key: 'productCode', width: 15 },
        { header: 'L1 Hierarchy', key: 'l1Hierarchy', width: 25 },
        { header: 'L2 Hierarchy', key: 'l2Hierarchy', width: 25 },
        { header: 'L3 Hierarchy', key: 'l3Hierarchy', width: 25 },
        { header: 'L4 Hierarchy', key: 'l4Hierarchy', width: 25 },
        { header: 'L5 Hierarchy', key: 'l5Hierarchy', width: 20 },
        { header: 'L6 Hierarchy', key: 'l6Hierarchy', width: 20 },
        { header: 'Portal Product', key: 'portalProduct', width: 20 },
        { header: 'Created Date', key: 'createdDate', width: 15 }
    ];
    
    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;
    
    // Add data rows
    for (const product of products) {
        worksheet.addRow({
            productName: product.productName,
            active: product.active,
            division: product.division,
            productCode: product.productCode,
            l1Hierarchy: product.l1Hierarchy,
            l2Hierarchy: product.l2Hierarchy,
            l3Hierarchy: product.l3Hierarchy,
            l4Hierarchy: product.l4Hierarchy,
            l5Hierarchy: product.l5Hierarchy,
            l6Hierarchy: product.l6Hierarchy,
            portalProduct: product.portalProduct,
            createdDate: product.createdDate
        });
    }
    
    // Add alternating row colors and borders
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                    bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                    left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                    right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
                };
            });
            
            if (rowNumber % 2 === 0) {
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF2F2F2' }
                    };
                });
            }
        }
    });
    
    // Auto-filter
    worksheet.autoFilter = {
        from: 'A1',
        to: 'L1'
    };
    
    // Freeze header row
    worksheet.views = [
        { state: 'frozen', ySplit: 1 }
    ];
    
    // Add summary worksheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 30 },
        { header: 'Value', key: 'value', width: 50 }
    ];
    
    // Style summary header
    const summaryHeader = summarySheet.getRow(1);
    summaryHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summaryHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
    };
    
    // Add summary data
    summarySheet.addRow({ metric: 'Total Products', value: products.length });
    summarySheet.addRow({ metric: 'Active Products', value: products.filter(p => p.active === 'Yes').length });
    summarySheet.addRow({ metric: 'Export Date', value: new Date().toISOString().split('T')[0] });
    summarySheet.addRow({ metric: 'Source File', value: 'All Products ~ MA Salesforce.pdf' });
    
    // Get unique L1 hierarchies
    const l1Hierarchies = [...new Set(products.map(p => p.l1Hierarchy).filter(h => h))];
    summarySheet.addRow({ metric: 'Unique L1 Hierarchies', value: l1Hierarchies.join(', ') });
    
    // Get unique divisions
    const divisions = [...new Set(products.map(p => p.division).filter(d => d))];
    summarySheet.addRow({ metric: 'Unique Divisions', value: divisions.join(', ') });
    
    // L1 Hierarchy breakdown
    summarySheet.addRow({ metric: '', value: '' });
    summarySheet.addRow({ metric: '--- L1 Hierarchy Breakdown ---', value: '' });
    for (const l1 of l1Hierarchies) {
        const count = products.filter(p => p.l1Hierarchy === l1).length;
        summarySheet.addRow({ metric: l1, value: count });
    }
    
    // Division breakdown
    summarySheet.addRow({ metric: '', value: '' });
    summarySheet.addRow({ metric: '--- Division Breakdown ---', value: '' });
    for (const div of divisions.sort()) {
        const count = products.filter(p => p.division === div).length;
        summarySheet.addRow({ metric: div, value: count });
    }
    
    // Save the workbook
    await workbook.xlsx.writeFile(OUTPUT_PATH);
    console.log(`Excel file saved to: ${OUTPUT_PATH}`);
    
    return OUTPUT_PATH;
}

/**
 * Main function
 */
async function main() {
    try {
        console.log('='.repeat(60));
        console.log('Salesforce Products PDF Parser');
        console.log('='.repeat(60));
        
        // Check if PDF exists
        if (!fs.existsSync(PDF_PATH)) {
            throw new Error(`PDF file not found: ${PDF_PATH}`);
        }
        
        console.log(`Input: ${PDF_PATH}`);
        console.log(`Output: ${OUTPUT_PATH}`);
        console.log('');
        
        // Parse PDF
        const fullText = await parsePDF();
        
        // Parse products from the text
        const products = parseProducts(fullText);
        
        if (products.length === 0) {
            console.log('\n⚠️  No products could be extracted from the PDF.');
            console.log('Check the raw text file for structure analysis.');
        }
        
        // Create Excel
        await createExcel(products);
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Processing complete!');
        console.log(`Products extracted: ${products.length}`);
        console.log(`Output file: ${OUTPUT_PATH}`);
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the script
main();
