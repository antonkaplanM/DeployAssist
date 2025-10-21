# Phase 1 Development Workflow

## 🎯 Goal: Migrate Dashboard Page to React

---

## 📋 Configuration Summary

### ✅ What Works:
- **Port 8080:** Express serving React build ✅
- **Authentication:** Working with cookies ✅
- **API calls:** Direct to backend ✅

### ❌ What Doesn't Work:
- **Port 8090:** Blocked by VPN/firewall ❌
- **Vite dev server:** Cannot use (no hot reload) ❌

---

## 🛠️ Development Workflow

Since we can't use Vite's dev server with hot reload, we'll use a build-and-refresh workflow:

### Step 1: Make Changes
Edit files in `frontend/src/` (React components, styles, etc.)

### Step 2: Build
```powershell
cd frontend
npm run build
```
This compiles React app to `frontend/dist/`

### Step 3: Test
- If server is already running: Just **refresh browser** (Ctrl+R)
- If server stopped: Restart it:
  ```powershell
  cd ..
  node app.js
  ```
- Visit: **http://localhost:8080**

### Step 4: Repeat
Make changes → Build → Refresh → Test

---

## 🚀 Quick Commands

### Start Development Session
```powershell
# Terminal 1 - Keep backend running
node app.js

# Terminal 2 - Use for builds
cd frontend
npm run build
# After each change, run: npm run build
```

### Full Restart (if needed)
```powershell
Stop-Process -Name node -Force
node app.js
```

---

## 📦 Phase 1 Plan: Dashboard Migration

### Current State
- Dashboard lives in `public/index.html` as inline HTML/JS
- Monolithic `public/script.js` handles all logic

### Target State
- Dashboard as React component: `frontend/src/pages/Dashboard.jsx`
- Fetches real data from existing APIs
- Reusable components in `frontend/src/components/`

### Implementation Steps

#### 1. ✅ Create API Services
```javascript
// frontend/src/services/dashboardService.js
export const getDashboardData = async () => {
  const [validation, removals, expiration] = await Promise.all([
    api.get('/api/validation-errors', { params: { ... } }),
    api.get('/api/ps-requests/removals', { params: { ... } }),
    api.get('/api/expiration-monitor', { params: { ... } })
  ]);
  return { validation, removals, expiration };
};
```

#### 2. ✅ Create Dashboard Components
- `DashboardLayout.jsx` - Main layout
- `DashboardWidget.jsx` - Reusable widget container
- `ValidationWidget.jsx` - Validation errors widget
- `RemovalsWidget.jsx` - Product removals widget
- `ExpirationWidget.jsx` - Expiration monitor widget

#### 3. ✅ Wire Up Real Data
- Replace placeholder data with API calls
- Handle loading states
- Handle error states
- Format data properly

#### 4. ✅ Style with Tailwind
- Match existing app's color scheme
- Responsive layout (grid or flexbox)
- Hover states, transitions

#### 5. ✅ Test
- Login flow
- Dashboard loads with real data
- All three widgets display correctly
- Data refreshes appropriately

---

## 🎨 Design Considerations

### Layout
```
┌────────────────────────────────────────────┐
│ Header: Welcome, [User] | [Logout]        │
├────────────────────────────────────────────┤
│                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │Validation│  │ Removals │  │Expiration││
│  │  Errors  │  │          │  │  Monitor ││
│  │          │  │          │  │          ││
│  │   [#]    │  │   [#]    │  │   [#]    ││
│  │          │  │          │  │          ││
│  └──────────┘  └──────────┘  └──────────┘│
│                                            │
└────────────────────────────────────────────┘
```

### Color Scheme (from existing app)
- Primary: `blue-600`
- Success: `green-600`
- Warning: `yellow-600`
- Error: `red-600`
- Background: `gray-50`
- Cards: `white` with `shadow`

---

## ✅ Phase 0 Complete - Lessons Learned

1. ✅ Fixed incorrect entry point (`main.ts` → `main.jsx`)
2. ❌ Port 8090 blocked by VPN - can't use Vite dev server
3. ✅ Port 8080 works - Express serving React build
4. ✅ Authentication working with cookies
5. ✅ API proxying not needed (same port)

---

## 📝 Next Steps

1. Start with Dashboard service layer
2. Create reusable widget components
3. Build Dashboard page with real data
4. Test thoroughly
5. Move to Phase 2 (other pages)

---

**Ready to start Phase 1!** 🚀



