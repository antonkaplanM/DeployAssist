import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userPages, setUserPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on mount
    const loadUserData = async () => {
      try {
        const userData = await authService.getCurrentUser();
        setUser(userData.user);
        
        // Fetch user's accessible pages
        const pagesData = await authService.getUserPages();
        setUserPages(pagesData.pages || []);
      } catch (error) {
        setUser(null);
        setUserPages([]);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, []);

  const login = async (username, password) => {
    const data = await authService.login(username, password);
    setUser(data.user);
    
    // Fetch pages after login
    try {
      const pagesData = await authService.getUserPages();
      setUserPages(pagesData.pages || []);
    } catch (error) {
      console.error('Failed to load user pages:', error);
      setUserPages([]);
    }
    
    return data;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setUserPages([]);
  };

  const hasPageAccess = (pageName) => {
    if (!user || !pageName) return false;
    return userPages.some(page => page.name === pageName);
  };

  const getAccessiblePages = () => {
    return userPages;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userPages,
      login, 
      logout, 
      loading,
      hasPageAccess,
      getAccessiblePages
    }}>
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


