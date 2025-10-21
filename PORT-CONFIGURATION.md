# Port Configuration - VPN Friendly Setup

## Current Configuration

### Backend (Express API)
- **Port:** 8080
- **URL:** http://localhost:8080
- **Purpose:** Serves old vanilla JS app + API endpoints
- **Status:** ✅ Running

### Frontend (React Dev Server)
- **Port:** 8090 (changed from 3000 for VPN compatibility)
- **URL:** http://localhost:8090
- **Purpose:** New React application
- **API Proxy:** Requests to `/api/*` are proxied to port 8080
- **Status:** ✅ Running

## Why Port 8090?

Your VPN was blocking ports 3000 and 8081, so we moved the React dev server to port 8090, which is typically allowed by corporate VPNs as it's a common alternative port.

## URLs to Access

### Old App (Vanilla JS)
👉 **http://localhost:8080**
- Your current production app
- Still fully functional during migration

### New App (React)
👉 **http://localhost:8090**
- New React-based app
- Login page and dashboard ready to test
- Uses same backend API

## Testing the Setup

1. **Backend:** Visit http://localhost:8080
   - Should load the old app
   - Verify you can login

2. **Frontend:** Visit http://localhost:8090
   - Should load the React login page
   - Use same credentials as old app
   - After login, see new React dashboard

## How It Works

```
Browser → http://localhost:8090 (React App)
                ↓
        React makes API call to /api/auth/login
                ↓
        Vite proxy forwards to http://localhost:8080/api/auth/login
                ↓
        Express backend handles the request
                ↓
        Response sent back to React app
```

## Starting the Servers

### Both Servers Together

**Terminal 1 - Backend:**
```powershell
cd C:\Users\kaplana\source\repos\hello-world-nodejs
node app.js
```

**Terminal 2 - Frontend:**
```powershell
cd C:\Users\kaplana\source\repos\hello-world-nodejs\frontend
npm run dev
```

### Single Command (optional)
You could also create a startup script, but for now, two terminals is fine.

## Updated Files

The following files were updated to use port 8090:

1. ✅ `frontend/vite.config.js` - Changed server port to 8090
2. ✅ `app.js` - Updated CORS to accept requests from 8090
3. ✅ `frontend/src/services/api.js` - Minor redirect fix

## Troubleshooting

### Port 8090 is blocked too?
Try other ports:
- 8082
- 8888
- 9000
- 9090

To change port:
1. Update `frontend/vite.config.js` - change `port: 8090` to your port
2. Update `app.js` - change `'http://localhost:8090'` in CORS to your port

### React app won't start?
- Check frontend terminal for errors
- Make sure no other process is using port 8081
- Try: `cd frontend && npm run dev`

### API calls fail?
- Verify backend is running on 8080
- Check browser Network tab for errors
- Look for CORS errors in console

---

**Ready to test?** Visit http://localhost:8090 and login! 🚀

