# React Migration Quick Start

## Prerequisites
- ✅ Node.js already installed
- ✅ Backend Express server working
- ✅ Git for version control

## Phase 0: Initial Setup (30 minutes)

### Step 1: Create Feature Branch
```powershell
git checkout -b feature/react-migration
```

### Step 2: Create React App with Vite
```powershell
# Create React app in 'frontend' directory
npm create vite@latest frontend -- --template react

# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Install additional packages
npm install react-router-dom axios

# Install Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Step 3: Configure Tailwind CSS

**File: `frontend/tailwind.config.js`**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#667eea',
        'primary-foreground': '#ffffff',
        accent: '#f7fafc',
        'accent-foreground': '#333',
        muted: '#718096',
        'muted-foreground': '#a0aec0',
      },
    },
  },
  plugins: [],
}
```

**File: `frontend/src/index.css`**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Step 4: Configure Vite to Proxy API Requests

**File: `frontend/vite.config.js`**
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
```

### Step 5: Update Backend to Support CORS (if needed)

**File: `app.js`** (add after existing middleware)
```javascript
// CORS for React dev server
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin === 'http://localhost:3000') {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
```

### Step 6: Create Basic Folder Structure

```powershell
cd frontend/src

# Create folders
New-Item -ItemType Directory -Force components/common
New-Item -ItemType Directory -Force components/layout
New-Item -ItemType Directory -Force components/features
New-Item -ItemType Directory -Force pages
New-Item -ItemType Directory -Force context
New-Item -ItemType Directory -Force services
New-Item -ItemType Directory -Force hooks
New-Item -ItemType Directory -Force utils
```

### Step 7: Test It Works

```powershell
# Terminal 1: Start backend
cd C:\Users\kaplana\source\repos\hello-world-nodejs
node app.js

# Terminal 2: Start React dev server
cd C:\Users\kaplana\source\repos\hello-world-nodejs\frontend
npm run dev
```

Visit:
- Backend: http://localhost:8080 (existing app)
- React: http://localhost:3000 (new app)

### Step 8: Create First Component - Login Page

This proves the setup works and gets you started!

**File: `frontend/src/services/api.js`**
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for auth errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

**File: `frontend/src/services/authService.js`**
```javascript
import api from './api';

export const authService = {
  async login(username, password) {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },

  async logout() {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  async getCurrentUser() {
    const response = await api.get('/auth/me');
    return response.data;
  },
};
```

**File: `frontend/src/context/AuthContext.jsx`**
```javascript
import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on mount
    authService.getCurrentUser()
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const data = await authService.login(username, password);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

**File: `frontend/src/pages/Login.jsx`**
```javascript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <h1 className="text-2xl font-bold text-center mb-6">
          Deploy Assist Login
        </h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-2 rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

**File: `frontend/src/pages/Dashboard.jsx`**
```javascript
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-gray-600 mt-1">Welcome, {user?.full_name}!</p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">Validation Errors</h2>
            <p className="text-gray-600">Coming soon...</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">Product Removals</h2>
            <p className="text-gray-600">Coming soon...</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">Expiration Monitor</h2>
            <p className="text-gray-600">Coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**File: `frontend/src/App.jsx`**
```javascript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
```

### Step 9: Test Login Flow

1. Start both servers (backend + React)
2. Visit http://localhost:3000
3. Should redirect to login
4. Login with your credentials
5. Should see Dashboard

🎉 **Success!** You now have:
- ✅ React app running
- ✅ API proxy working
- ✅ Authentication working
- ✅ Protected routes working
- ✅ Basic dashboard

## Next Steps

After Phase 0 is complete:
1. Review the full MIGRATION-PLAN.md
2. Prioritize which features to migrate first
3. Start building components for Phase 1
4. Commit frequently to git

## Useful Commands

```powershell
# Start both servers together (in separate terminals)

# Terminal 1 - Backend
cd C:\Users\kaplana\source\repos\hello-world-nodejs
node app.js

# Terminal 2 - Frontend  
cd C:\Users\kaplana\source\repos\hello-world-nodejs\frontend
npm run dev

# Build for production (later)
npm run build
```

## Troubleshooting

**API requests fail?**
- Check Vite proxy config
- Check CORS headers on backend
- Check Network tab in DevTools

**Styles not working?**
- Make sure Tailwind is imported in index.css
- Check tailwind.config.js paths
- Restart dev server

**React not loading?**
- Check console for errors
- Make sure all dependencies installed: `npm install`
- Clear cache: `npm run dev -- --force`


