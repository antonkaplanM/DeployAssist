# PDF Parser Tool - Salesforce Products

## Overview

The PDF Parser tool extracts product data from Salesforce PDF exports and converts them into structured Excel spreadsheets. This is particularly useful for processing the "All Products" printable view from Salesforce.

---

## Usage

### Command
```bash
node scripts/parse-salesforce-products-pdf.js
```

### Input
- **File**: `docs/data/All Products ~ MA Salesforce.pdf`
- **Format**: Salesforce printable view PDF containing product table

### Output
- **File**: `docs/data/All_Products_MA_Salesforce.xlsx`
- **Sheets**:
  - **All Products**: Complete product listing with all columns
  - **Summary**: Statistics and breakdown by hierarchy/division

---

## Column Mapping

The parser extracts the following columns from the PDF:

| Column | Description |
|--------|-------------|
| Product Name | Name of the product |
| Active (Product) | Whether the product is active (Yes/No) |
| Division | Division code (BVD, LEW, MKMV, ISG, ERS) |
| Product Code | 5-digit product code |
| L1 Hierarchy | Top-level hierarchy (Decision Solutions, Research and Insights, etc.) |
| L2 Hierarchy | Second-level hierarchy |
| L3 Hierarchy | Third-level hierarchy |
| L4 Hierarchy | Fourth-level hierarchy |
| L5 Hierarchy | Fifth-level hierarchy |
| L6 Hierarchy | Sixth-level hierarchy |
| Portal Product | Portal product name |
| Created Date | Date the product was created |

---

## How It Works

1. **PDF Loading**: Uses `pdfjs-dist` to load and parse the PDF file
2. **Text Extraction**: Extracts text content from all pages, maintaining row structure
3. **Row Detection**: Identifies product rows by finding lines ending with dates (M/D/YYYY format)
4. **Field Parsing**: Extracts individual fields using pattern matching:
   - Product codes: 5-digit numbers
   - Divisions: Known division codes (BVD, LEW, MKMV, etc.)
   - L1 Hierarchies: Known hierarchy names
5. **Excel Generation**: Creates formatted Excel workbook with:
   - Styled headers
   - Auto-filters
   - Frozen header row
   - Alternating row colors
   - Summary statistics

---

## Dependencies

- `pdfjs-dist`: PDF parsing library
- `exceljs`: Excel file generation

---

## Output Details

### All Products Sheet
- Contains all 1000 products from the PDF
- Sortable and filterable
- Blue header row with white text
- Alternating row colors for readability

### Summary Sheet
Contains:
- Total Products count
- Active Products count
- Export Date
- Source File
- Unique L1 Hierarchies
- Unique Divisions
- Breakdown by L1 Hierarchy
- Breakdown by Division

---

## Debugging

The script saves intermediate data for troubleshooting:

- **Raw Text**: `docs/data/pdf_raw_text.txt` - The extracted raw text from the PDF

If products are not being extracted correctly, review the raw text file to understand the text structure.

---

## Limitations

- The parser is designed for the specific format of Salesforce "All Products" printable view
- Maximum of 1000 records (Salesforce printable view limitation)
- Column detection relies on pattern matching and may need adjustment for different PDF layouts

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-12 | 1.0.0 | Initial implementation |

---

**Last Updated**: January 12, 2026  
**Status**: ✅ Production Ready
