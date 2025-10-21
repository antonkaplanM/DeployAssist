/**
 * Launcher for Old JavaScript App
 * Runs the app on port 5000 serving the old public folder
 */

// Force port 5000
process.env.PORT = '5000';

// Load the main app
const path = require('path');

console.log('\n🕰️  Starting OLD JavaScript App for Comparison...');
console.log('📁 Serving from: ./public');
console.log('🚀 Port: 5000');
console.log('🌐 URL: http://localhost:5000\n');

// Load and run the main app
const app = require('./app.js');

// Start the server (app.js only starts if run directly, so we need to start it here)
app.listen(5000, '0.0.0.0', () => {
    console.log(`🚀 Backend API Server is running on http://0.0.0.0:5000`);
    console.log(`📁 Serving static files from ./public`);
    console.log(`🔗 API endpoints available at /api/*`);
});


