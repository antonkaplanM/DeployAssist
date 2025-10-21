# Port Testing Guide for Firewall/VPN Compatibility

**Goal:** Find a port that works with your firewall/VPN so you can run the old app for comparison.

---

## 🎯 Ports to Test (Ordered by Likelihood)

### Highly Likely to Work:
1. **Port 5000** - Very common for Node.js/Express apps
2. **Port 4000** - Alternative development port
3. **Port 8000** - Alternative HTTP port (often unblocked)

### Moderately Likely:
4. **Port 3001** - Alternative to 3000
5. **Port 5500** - Live Server default
6. **Port 8888** - Common for proxy servers

### Worth Trying:
7. **Port 7000** - Another common dev port
8. **Port 9000** - Sometimes unblocked
9. **Port 6000** - Less common but possible

---

## 📋 Testing Process

### Quick Test (Recommended):
Try these ports in order. For each port:

1. **Update the old app's port:**
   ```bash
   # In app.js, find the PORT variable (around line 3073)
   # Change it temporarily to test
   ```

2. **Start server on new port:**
   ```bash
   PORT=5000 node app.js
   ```

3. **Test in browser:**
   ```
   http://localhost:5000
   ```

4. **If it works:** ✅ Note the port and move on to comparison
5. **If blocked:** ❌ Stop server and try next port

---

## 🔧 Current Configuration

### New React App:
- **Port:** 8080 (working)
- **Location:** Express serving `frontend/dist`
- **Status:** ✅ Running

### Old JavaScript App:
- **Port:** 8080 (default, but we need to change this)
- **Location:** Express serving `public`
- **Status:** ⏳ Need to configure on different port

---

## 🚀 Quick Start: Test Port 5000

Let's start with port 5000 (most likely to work):

### Option A: Temporary Test (Quick)
```bash
# Stop the current server (Ctrl+C if running)
# Then start on port 5000:
PORT=5000 node app.js
```

### Option B: Configure Old App Copy (Better)
1. Copy `app.js` to `app-old.js`
2. In `app-old.js`, change:
   ```javascript
   const PORT = process.env.PORT || 5000;  // Changed from 8080
   ```
3. Change static file serving:
   ```javascript
   app.use(express.static(path.join(__dirname, 'public')));  // Not frontend/dist
   ```
4. Run old app:
   ```bash
   node app-old.js
   ```

---

## 📊 Port Testing Results

Test each port and record results:

| Port | Status | Notes |
|------|--------|-------|
| 5000 | ⏳ | Common Node.js port |
| 4000 | ⏳ | Alternative dev port |
| 8000 | ⏳ | Alternative HTTP |
| 3001 | ⏳ | Alt to 3000 |
| 5500 | ⏳ | Live Server default |
| 8888 | ⏳ | Proxy server port |

---

## ✅ Once You Find a Working Port:

1. **Keep new React app on 8080**
2. **Run old app on working port** (e.g., 5000)
3. **Compare side-by-side:**
   - New app: `http://localhost:8080`
   - Old app: `http://localhost:5000`

---

## 🛠️ Automated Testing

If you want to test all ports automatically:

```bash
node test-ports.js
```

This will:
- Try each port sequentially
- Show success/failure for each
- Open a test page if accessible
- Press Ctrl+C to test next port

---

## 📝 Recommendation

**Start with port 5000** - it's the most commonly unblocked port for Node.js development.

If 5000 doesn't work, try 4000, then 8000.

Most VPN/firewalls block higher ports (8081, 8090, 9000+) but allow lower common development ports (3000-5000 range).



