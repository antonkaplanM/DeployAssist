import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
import { AutoRefreshProvider } from '../context/AutoRefreshContext';

interface AllTheProvidersProps {
  children: React.ReactNode;
}

const AllTheProviders: React.FC<AllTheProvidersProps> = ({ children }) => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AutoRefreshProvider>
              {children}
            </AutoRefreshProvider>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Create a mock authenticated user
export const mockUser = {
  id: '1',
  username: 'testuser',
  full_name: 'Test User',
  email: 'test@example.com',
  role: 'admin' as const,
  isActive: true,
  created_at: new Date().toISOString(),
};

// Create a mock limited user
export const mockLimitedUser = {
  id: '2',
  username: 'limiteduser',
  full_name: 'Limited User',
  email: 'limited@example.com',
  role: 'user' as const,
  isActive: true,
  created_at: new Date().toISOString(),
};

// Export everything from React Testing Library
export * from '@testing-library/react';
export { customRender as render };

