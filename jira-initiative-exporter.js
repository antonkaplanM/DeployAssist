const XLSX = require('xlsx');
const fs = require('fs');

/**
 * Jira Initiative Exporter
 * Creates an Excel file with initiatives assigned to Kevin Yu
 */

// Sample data structure - replace with actual Jira data
const sampleInitiatives = [
    {
        id: 'PROJ-123',
        name: 'Sample Initiative 1',
        assignee: 'Kevin Yu',
        status: 'In Progress',
        created: '2025-01-15',
        updated: '2025-01-20'
    },
    {
        id: 'PROJ-124', 
        name: 'Sample Initiative 2',
        assignee: 'Kevin Yu',
        status: 'To Do',
        created: '2025-01-10',
        updated: '2025-01-18'
    }
];

/**
 * Function to create Excel file from initiative data
 * @param {Array} initiatives - Array of initiative objects
 * @param {string} filename - Output filename
 */
function createInitiativeExcel(initiatives, filename = 'kevin_yu_initiatives.xlsx') {
    try {
        // Prepare data for Excel
        const worksheetData = [
            // Header row
            ['Initiative ID', 'Initiative Name', 'Assignee', 'Status', 'Created Date', 'Last Updated'],
            // Data rows
            ...initiatives.map(initiative => [
                initiative.id,
                initiative.name,
                initiative.assignee,
                initiative.status,
                initiative.created,
                initiative.updated
            ])
        ];

        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

        // Set column widths for better readability
        worksheet['!cols'] = [
            { wch: 15 }, // Initiative ID
            { wch: 40 }, // Initiative Name
            { wch: 15 }, // Assignee
            { wch: 15 }, // Status
            { wch: 15 }, // Created Date
            { wch: 15 }  // Last Updated
        ];

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Kevin Yu Initiatives');

        // Write file
        XLSX.writeFile(workbook, filename);
        
        console.log(`✅ Excel file created successfully: ${filename}`);
        console.log(`📊 Total initiatives: ${initiatives.length}`);
        
        return filename;
        
    } catch (error) {
        console.error('❌ Error creating Excel file:', error);
        throw error;
    }
}

/**
 * Function to export initiatives using manual Jira export data
 * Call this function with your actual Jira data
 */
function exportKevinYuInitiatives(jiraData = null) {
    console.log('🚀 Starting Jira Initiative Export for Kevin Yu...');
    
    // Use provided data or sample data
    const initiatives = jiraData || sampleInitiatives;
    
    if (!initiatives || initiatives.length === 0) {
        console.log('⚠️ No initiatives found for Kevin Yu');
        return;
    }
    
    // Filter for Kevin Yu (in case the data includes other assignees)
    const kevinYuInitiatives = initiatives.filter(
        initiative => initiative.assignee && 
        initiative.assignee.toLowerCase().includes('kevin yu')
    );
    
    if (kevinYuInitiatives.length === 0) {
        console.log('⚠️ No initiatives found assigned to Kevin Yu');
        return;
    }
    
    // Create Excel file
    const filename = createInitiativeExcel(kevinYuInitiatives);
    
    console.log('\\n📋 Summary:');
    console.log(`   • Total initiatives for Kevin Yu: ${kevinYuInitiatives.length}`);
    console.log(`   • Excel file: ${filename}`);
    console.log(`   • Location: ${__dirname}`);
    
    return filename;
}

// Instructions for manual data input
function showInstructions() {
    console.log('\\n📖 INSTRUCTIONS FOR MANUAL JIRA EXPORT:');
    console.log('=====================================');
    console.log('');
    console.log('1. 🔍 Go to your Jira instance');
    console.log('2. 🔎 Use this JQL query:');
    console.log('   assignee = "Kevin Yu" AND type = Initiative');
    console.log('');
    console.log('3. 📝 Export the results or copy the data');
    console.log('4. 🔧 Update the jiraData variable in this script with:');
    console.log('   [');
    console.log('     {');
    console.log('       id: "PROJ-123",');
    console.log('       name: "Initiative Name",');
    console.log('       assignee: "Kevin Yu",');
    console.log('       status: "Status",');
    console.log('       created: "YYYY-MM-DD",');
    console.log('       updated: "YYYY-MM-DD"');
    console.log('     }');
    console.log('   ]');
    console.log('');
    console.log('5. 🏃 Run: node jira-initiative-exporter.js');
    console.log('');
    console.log('📧 Alternative: Email your Jira admin to set up API access');
}

// Main execution
if (require.main === module) {
    console.log('🎯 Jira Initiative Exporter for Kevin Yu');
    console.log('========================================');
    
    // Show instructions for manual export
    showInstructions();
    
    console.log('\\n🧪 Creating sample Excel file with template data...');
    
    // Create sample file to show structure
    exportKevinYuInitiatives();
    
    console.log('\\n✨ Template Excel file created!');
    console.log('Replace the sample data with actual Jira data and run again.');
}

module.exports = {
    createInitiativeExcel,
    exportKevinYuInitiatives
};



