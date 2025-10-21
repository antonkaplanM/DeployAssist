# Server Setup Guide

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  Backend Server (Port 5000)                         │
│  - Express.js API endpoints (/api/*)               │
│  - Serves OLD app frontend from /public            │
│  - Authentication, DB, Salesforce integration      │
│                                                     │
└─────────────────────────────────────────────────────┘
                          ▲
                          │ API Proxy
                          │
┌─────────────────────────────────────────────────────┐
│                                                     │
│  React App (Port 8080)                              │
│  - Vite dev server                                 │
│  - Serves NEW React app                            │
│  - Proxies /api/* requests to port 5000           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## How to Start Servers

### Option 1: PowerShell (Separate Terminals)

**Terminal 1 - Backend:**
```powershell
$env:PORT="5000"
node app.js
```

**Terminal 2 - React App:**
```powershell
cd frontend
npm run dev
```

### Option 2: PowerShell (Background Processes)

```powershell
# Start backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PORT='5000'; node app.js"

# Start React app
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"
```

## Verify Servers are Running

### Backend (Port 5000)
- Open: http://localhost:5000
- Should see: **OLD app** (public/index.html)
- Test API: http://localhost:5000/api/health

### React App (Port 8080)
- Open: http://localhost:8080
- Should see: **NEW React app** (login page)
- API calls automatically proxy to port 5000

## Testing Account History Page

1. ✅ **Start both servers** (steps above)

2. ✅ **Open React app**: http://localhost:8080

3. ✅ **Login**:
   - Username: `admin`
   - Password: `admin123`

4. ✅ **Navigate to Account History**:
   - Click **Analytics** in sidebar
   - Click **Account History**

5. ✅ **Test the page**:
   - Search for "Bank of America"
   - Select account from dropdown
   - Verify table displays with filters

## Troubleshooting

### "Login keeps failing"
- ✅ Check backend is running on port 5000
- ✅ Check React app is running on port 8080
- ✅ Open browser console (F12) for errors
- ✅ Check Network tab for failed API calls

### "Cannot connect to API"
- React app proxies `/api/*` to `http://localhost:5000`
- Make sure backend is running on port 5000
- Check `frontend/vite.config.js` proxy settings

### "Port already in use"
```powershell
# Kill all Node processes
Stop-Process -Name node -Force

# Restart servers
```

## Current Status

✅ **Backend**: Should be running on port 5000  
✅ **React App**: Should be running on port 8080  
✅ **Account History**: Updated to match old app  
✅ **Authentication**: Global test setup fixed  

## Next Steps

1. Manually test Account History page in browser
2. Confirm all features work:
   - ✅ Search and select account
   - ✅ Table displays requests
   - ✅ Deployment filter works
   - ✅ Show limit selector works
   - ✅ Product changes toggle works
   - ✅ Can select 2 requests for comparison
   - ✅ Can view side-by-side modal
   - ✅ Can clear selection
3. Run E2E tests once manual testing passes

