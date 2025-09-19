# Hello World Node.js App 🚀

A simple Hello World application built with Node.js and Express, featuring a modern, responsive UI.

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
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
hello-world-nodejs/
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
- `GET /health` - Health check endpoint for Docker

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
- **🌙 Dark Mode**: Toggle between light and dark themes
- **✨ Enhanced UI**: Cards, buttons, and inputs follow shadcn/ui patterns
- **♿ Better Accessibility**: Focus indicators and screen reader support
- **🎬 Improved Animations**: Subtle entrance animations and hover effects
- **🔧 MCP Integration**: Model Context Protocol configured for enhanced AI assistance

## Navigation Features

### **Pages**
1. **Landing Page**: Original Hello World functionality with greeting system
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

## Docker Deployment 🐳

This application is fully containerized and ready for deployment with Docker Desktop.

### Prerequisites

- **Docker Desktop** installed and running
- **Windows Containers** (default configuration)
  - Ensure Docker Desktop is set to "Windows containers" mode
  - Right-click Docker Desktop system tray icon
  - Select "Switch to Windows containers..." if currently using Linux containers

### Quick Start with Docker

#### Option 1: Using Docker Compose (Recommended)

```bash
# Build and start the application
docker-compose up --build

# Run in detached mode (background)
docker-compose up -d --build

# Stop the application
docker-compose down
```

#### Option 2: Using Docker Commands

```bash
# Build the image
docker build -t hello-world-nodejs .

# Run the container
docker run -p 3000:3000 --name hello-world-app hello-world-nodejs

# Run in detached mode
docker run -d -p 3000:3000 --name hello-world-app hello-world-nodejs

# Stop and remove container
docker stop hello-world-app
docker rm hello-world-app
```

### Docker Files Included

- **`Dockerfile`** - Windows containers (default configuration)
- **`Dockerfile.linux`** - Linux containers (alternative)
- **`Dockerfile.windows`** - Alternative Windows Server Core image
- **`docker-compose.yml`** - Easy deployment configuration
- **`.dockerignore`** - Optimized build context

### Docker Features

- ✅ **Health Checks** - Automatic container health monitoring via `/health` endpoint
- ✅ **Windows Containers** - Optimized for Windows Docker Desktop
- ✅ **Multi-stage Build** - Efficient Node.js installation and setup
- ✅ **Port Mapping** - Accessible on http://localhost:3000
- ✅ **Auto Restart** - Container restarts automatically unless stopped
- ✅ **Production Ready** - Environment variables and proper configuration

### Troubleshooting

**If you see "no matching manifest" errors:**
1. Ensure Docker Desktop is set to **Windows containers** mode
2. Alternatively, use the Linux Dockerfile:
   ```bash
   docker build -f Dockerfile.linux -t hello-world-nodejs .
   ```

**Alternative Windows Server Core image:**
If you encounter issues with the Nano Server image, try the Server Core version:
```bash
docker build -f Dockerfile.windows -t hello-world-nodejs .
```

**Check container status:**
```bash
# View running containers
docker ps

# View all containers
docker ps -a

# View container logs
docker logs hello-world-app
```

### Production Deployment

For production environments, consider:
- Using a container orchestration platform (Kubernetes, Docker Swarm)
- Setting up proper environment variables
- Implementing proper logging and monitoring
- Using a reverse proxy (nginx, traefik)

### Container Configuration

**Current Setup:**
- **Base Image**: Windows Nano Server LTSC 2022
- **Node.js Version**: 18.20.4
- **Container Type**: Windows containers
- **Health Monitoring**: Built-in health checks every 30 seconds

**Available Endpoints:**
- `http://localhost:3000` - Main application  
- `http://localhost:3000/health` - Health check endpoint
- `http://localhost:3000/api/greeting` - API endpoint
- `http://localhost:3000/api/jira/initiatives` - Jira initiatives API (mock data)

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

Enjoy building with Node.js, shadcn/ui, and Docker on Windows! 🎉
