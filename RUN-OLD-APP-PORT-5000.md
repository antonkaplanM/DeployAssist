# 🚀 Run Old App on Port 5000 - Simplified

## Option 1: Quick Command (Easiest)

### Step 1: Edit app.js
Change these **2 lines** in `app.js`:

**Line ~48 (PORT):**
```javascript
const PORT = process.env.PORT || 5000;  // Changed from 8080
```

**Line with `express.static(frontend/dist)` - change to:**
```javascript
app.use(express.static(path.join(__dirname, 'public')));  // Changed from frontend/dist
```

### Step 2: Run
```powershell
node app.js
```

### Step 3: Test
Open: http://localhost:5000

---

## Option 2: Use Environment Variable (Cleaner)

Keep app.js at port 8080, but run with PORT override:

```powershell
$env:PORT=5000; node app.js
```

**BUT** you still need to change the static files line to serve `public` instead of `frontend/dist`.

---

## ✅ If Port 5000 Works

You'll see:
```
🚀 Server is running on http://0.0.0.0:5000
📁 Serving static files from ./public
```

Then you can compare:
- **Old App:** http://localhost:5000 (JavaScript)
- **New App:** http://localhost:8080 (React) ← Keep this running in another terminal

---

## ❌ If Port 5000 is Blocked

Try these ports in order:

### Port 4000:
```javascript
const PORT = process.env.PORT || 4000;
```

### Port 8000:
```javascript
const PORT = process.env.PORT || 8000;
```

### Port 3001:
```javascript
const PORT = process.env.PORT || 3001;
```

---

## 🎯 Quick Summary

**To run old app for comparison:**

1. **Stop current server** (if running)
2. **Edit app.js line 48:** Change `8080` → `5000`
3. **Edit app.js** (find express.static): Change `'frontend/dist'` → `'public'`
4. **Run:** `node app.js`
5. **Test:** http://localhost:5000

**Most likely ports to work:** 5000, 4000, 8000

Would you like me to help you make these changes to app.js now?



