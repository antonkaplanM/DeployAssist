# Phase 0 - Port 8090 Test Configuration

## Purpose
Testing whether the previous port 8090 blocking issue was due to:
- ❓ VPN/firewall blocking the port
- ✅ **OR** Incorrect entry point (main.ts vs main.jsx) - which we just fixed

---

## Current Configuration

### Backend (Express) - Port 8080
- **URL:** http://localhost:8080
- **Serving:** Old SPA from `./public`
- **CORS:** Enabled for `http://localhost:8090`
- **Status:** ✅ Running

### Frontend (React + Vite) - Port 8090
- **URL:** http://localhost:8090
- **Entry Point:** `/src/main.jsx` (✅ Fixed!)
- **Proxy:** API calls to `http://localhost:8080`
- **Status:** ✅ Running

---

## Testing Steps

### 1️⃣ Test Port 8090 (React Dev Server)
Visit: **http://localhost:8090**

**Expected:**
- ✅ See React login page
- ✅ "Deploy Assist" header
- ✅ Modern, clean UI

**If it works:**
- 🎉 **The issue was the incorrect entry point** (`main.ts` → `main.jsx`)
- The VPN is NOT blocking port 8090
- We can use Vite dev server for hot-reload during migration

**If it fails:**
- 🚫 VPN/firewall is blocking port 8090
- Continue using port 8080 (Express serving React build)
- Hot-reload will require manual rebuild + restart

---

### 2️⃣ Test Login Flow on Port 8090
1. Enter your credentials
2. Click "Sign In"
3. Should see Dashboard with:
   - Welcome message
   - "Phase 0 Complete! 🎉" banner
   - Three placeholder widgets
   - Logout button

---

### 3️⃣ Verify API Communication
Check browser console (F12):
- Should see no CORS errors
- API calls to `/api/*` should proxy to port 8080
- Authentication should work seamlessly

---

## What to Report

Please let me know:
1. ✅ **Can you access http://localhost:8090?**
2. ✅ **Do you see the React login page?**
3. ✅ **Can you login successfully?**
4. ✅ **Do you see the dashboard?**
5. ❌ **Any errors in browser console?**

---

## Next Steps Based on Results

### If Port 8090 Works ✅
- **Proceed with Phase 1** using Vite dev server on 8090
- Benefits:
  - Hot module reload (instant changes)
  - Better development experience
  - Source maps for debugging

### If Port 8090 Still Fails ❌
- **Proceed with Phase 1** but build to port 8080
- Workflow:
  1. Make changes in `frontend/src/`
  2. Run `npm run build` in `frontend/`
  3. Refresh browser on http://localhost:8080
- Slower but works around VPN

---

## How to Stop Servers
```powershell
Stop-Process -Name node -Force
```

## How to Restart Servers
```powershell
# Terminal 1 (Backend)
node app.js

# Terminal 2 (Frontend)
cd frontend
npm run dev
```

---

**Ready to test!** 🚀 Visit **http://localhost:8090** now!



