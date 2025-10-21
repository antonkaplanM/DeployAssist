# Quick Test: Port 5000

## 🎯 Goal
Run the old app on port 5000 to compare with the new React app on 8080.

---

## ⚡ Quick Steps

### 1. Stop the current server
If the server is running on port 8080, press **Ctrl+C** to stop it.

### 2. Temporarily modify app.js (2 changes)

**Change #1 - Port (around line 48):**
```javascript
// FROM:
const PORT = process.env.PORT || 8080;

// TO:
const PORT = process.env.PORT || 5000;
```

**Change #2 - Static files (search for "express.static"):**
```javascript
// FROM:
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));

// TO:
app.use(express.static(path.join(__dirname, 'public')));
```

**Change #3 - Home route (search for "Route for the home page"):**
```javascript
// FROM:
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

// TO:
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
```

**Change #4 - Disable catch-all route (search for "Catch-all route"):**
```javascript
// FROM:
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

// TO:
// app.get('*', (req, res) => {
//     res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
// });
```

### 3. Start the server
```bash
node app.js
```

### 4. Test in browser
Open: **http://localhost:5000**

### 5. If it works ✅
- Port 5000 is compatible!
- You can now compare:
  - **Old app:** http://localhost:5000 (public folder)
  - **New app:** http://localhost:8080 (React build)

### 6. If it doesn't work ❌
- Stop the server (Ctrl+C)
- Change PORT to 4000 (step 2, change #1)
- Try again

---

## 🔄 Restore to New App

After comparison, restore app.js:

**Restore #1 - Port:**
```javascript
const PORT = process.env.PORT || 8080;
```

**Restore #2 - Static files:**
```javascript
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));
```

**Restore #3 - Home route:**
```javascript
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});
```

**Restore #4 - Re-enable catch-all:**
```javascript
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});
```

---

## 📊 Ports to Try (in order)

1. **5000** ← Start here
2. **4000**
3. **8000**
4. **3001**
5. **5500**

Most likely, 5000 or 4000 will work!



