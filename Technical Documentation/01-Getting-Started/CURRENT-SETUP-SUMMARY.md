# Development Setup

**Backend**: Port 5000 (JavaScript - `app.js`)  
**Frontend**: Port 8080 (Vite with hot reload)  
**Access**: http://localhost:8080

---

## 🚀 Quick Start

**Terminal 1:**
```bash
npm start
```

**Terminal 2:**
```bash
npm run dev:frontend
```

**Browser:**
```
http://localhost:8080
```

---

## 🎯 Architecture

```
Browser (localhost:8080)
    ↓
Vite Dev Server (port 8080)
    ├── Serves React source with hot reload ⚡
    └── Proxies /api and /auth to backend
            ↓
    JavaScript Backend (port 5000)
        ├── API endpoints
        ├── Authentication
        ├── Salesforce integration
        └── Database
```

---

## ⚡ Development Workflow

### Making Frontend Changes
1. Edit files in `frontend/src/`
2. Save
3. Changes appear automatically (hot reload)
4. No restart needed ✅

### Making Backend Changes
1. Edit files like `app.js`, `database.js`
2. Save
3. Stop backend (`Ctrl+C` in Terminal 1)
4. Restart: `npm start`
5. Frontend keeps running ✅

---

## 🔧 Port Reference

| What | Port | Command |
|------|------|---------|
| Backend API | 5000 | `npm start` |
| Frontend Dev | 8080 | `npm run dev:frontend` |
| Access in Browser | 8080 | http://localhost:8080 |

---

## ❓ Quick Troubleshooting

### Issue: React not loading properly
**Solution**: Make sure you're accessing port 8080, not 5000

### Issue: API calls failing
**Solution**: Make sure backend is running on port 5000
```bash
curl http://localhost:5000/health
```

### Issue: Port in use
**Solution**:
```powershell
netstat -ano | findstr :5000
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

---

That's it! Hot reload enabled. 🔥

