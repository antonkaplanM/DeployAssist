# Deployment Assistant 🚀

A deployment assistant application built with Node.js and Express, featuring a modern, responsive UI and comprehensive integrations for DevOps workflows.

## Features

- **Express.js Backend**: Fast and lightweight web server
- **Modern UI**: Beautiful, responsive design with animations
- **Interactive Greeting**: Dynamic greeting API with personalization
- **Real-time Updates**: Live timestamps and smooth animations
- **Mobile Responsive**: Works perfectly on all devices

## Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start the Server**:
   ```bash
   npm start
   ```

3. **Open in Browser**:
   Navigate to [http://localhost:8080](http://localhost:8080)

## Project Structure

```
deployment-assistant/
├── app.js              # Express server
├── package.json        # Project configuration
├── public/            # Static files
│   ├── index.html     # Main HTML page
│   ├── styles.css     # Modern CSS styling
│   └── script.js      # Interactive JavaScript
└── README.md          # This file
```

## API Endpoints

- `GET /` - Serves the main HTML page
- `GET /api/greeting?name=YourName` - Returns personalized greeting JSON
- `POST /api/jira/initiatives` - Returns Jira initiatives data (currently mock data)
- `GET /health` - Health check endpoint

## Technologies Used

- **Backend**: Node.js, Express.js
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Design System**: shadcn/ui design principles
- **Styling**: Tailwind CSS with custom CSS variables
- **Fonts**: Google Fonts (Inter)
- **Features**: Dark mode, responsive design, smooth animations

## Development

The application includes:
- 🎨 shadcn/ui design system with consistent styling
- 🌙 Dark/Light mode toggle (Ctrl/Cmd + D)
- ⚡ Smooth animations and transitions
- 📱 Responsive design for all screen sizes
- 🔄 Real-time API integration
- ✨ Interactive elements with visual feedback
- 🎯 Accessibility-focused components
- ⌨️ Keyboard shortcuts and navigation

## New Features

- **🚀 Navigation Sidebar**: Left-side navigation with Landing Page, Analytics, and Roadmap sections
- **📊 Analytics Dashboard**: Dedicated analytics page with data table and statistics cards
- **🗺️ Roadmap Page**: Jira integration for Kevin Yu's initiatives with search, filter, and export
- **👥 Customer Products**: View all active products for customers organized by region and category
- **⏰ Expiration Monitor**: Track product entitlements expiring within configurable timeframes
- **📈 Account History**: Chronological view of all Technical Team Requests for an account
- **🌙 Dark Mode**: Toggle between light and dark themes
- **✨ Enhanced UI**: Cards, buttons, and inputs follow shadcn/ui patterns
- **♿ Better Accessibility**: Focus indicators and screen reader support
- **🎬 Improved Animations**: Subtle entrance animations and hover effects
- **🔧 MCP Integration**: Model Context Protocol configured for enhanced AI assistance

## Navigation Features

### **Pages**
1. **Dashboard**: Welcome page with greeting system
2. **Analytics Dashboard**: Empty table ready for account data with columns:
   - Account ID
   - Account Name
   - Number of Products
3. **Roadmap**: Platform initiatives assigned to Kevin Yu with:
   - Key, Summary, Status, Created/Updated dates, Description
   - Filter by status (Proposed, Committed, Open)
   - Search across all fields
   - Sortable columns
   - CSV export functionality

### **Keyboard Shortcuts**
- `Ctrl/Cmd + D` - Toggle dark/light theme
- `Ctrl/Cmd + 1` - Navigate to Landing Page
- `Ctrl/Cmd + 2` - Navigate to Analytics Page
- `Ctrl/Cmd + 3` - Navigate to Roadmap Page
- `Ctrl/Cmd + ←/→` - Navigate between pages
- `Escape` - Clear input field (Landing page only)

### **Features**
- **Persistent Navigation**: Remembers your last visited page
- **Smooth Transitions**: Animated page switching
- **Responsive Design**: Sidebar adapts to different screen sizes
- **shadcn/ui Components**: Clean table and navigation components

## Jira Integration

The Roadmap page includes integration with Jira to display Kevin Yu's initiatives. 

### Current Status
- ✅ **UI Complete**: Full roadmap interface with search, filter, and export
- ✅ **API Endpoint**: `/api/jira/initiatives` ready for real data
- 🔄 **Mock Data**: Currently using sample data for demonstration
- ⏳ **Real Integration**: Requires Atlassian MCP authentication setup

### Features
- **Search**: Find initiatives by key, summary, or description
- **Filter**: Filter by status (Proposed, Committed, Open)
- **Sort**: Click column headers to sort data
- **Export**: Download filtered data as CSV
- **Refresh**: Manual data refresh with loading states

### Setup Real Jira Data
See `JIRA_INTEGRATION.md` for detailed setup instructions including:
- Atlassian API token creation
- MCP server configuration  
- JQL query customization
- Authentication troubleshooting

## Testing

This repo includes a testing framework to prevent unintended behavior changes.

### Stack

- Jest for unit/integration tests (with Supertest and Nock)
- Playwright for UI end-to-end tests

### Commands

```bash
npm test            # run unit & integration tests with coverage
npm run test:e2e    # run Playwright e2e tests (requires app running on :8080 or set E2E_BASE_URL)
```

See `Technical Documentation/Testing-Strategy.md` for details.
