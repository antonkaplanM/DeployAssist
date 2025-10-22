import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Get initial theme from localStorage or default to 'light'
  const getInitialTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'light';
  };

  const [theme, setTheme] = useState(getInitialTheme());

  // Apply theme to document element
  useEffect(() => {
    const root = window.document.documentElement;
    
    console.log('[Theme] Before change:', {
      currentClasses: root.className,
      newTheme: theme
    });
    
    // Remove old theme class
    root.classList.remove('light', 'dark');
    
    // Add new theme class
    root.classList.add(theme);
    
    // Save to localStorage
    localStorage.setItem('theme', theme);
    
    console.log('[Theme] After change:', {
      newClasses: root.className,
      appliedTheme: theme
    });
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const setLightMode = () => setTheme('light');
  const setDarkMode = () => setTheme('dark');

  const value = {
    theme,
    toggleTheme,
    setLightMode,
    setDarkMode,
    isDark: theme === 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

