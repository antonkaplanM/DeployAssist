import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AutoRefreshProvider } from './context/AutoRefreshContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import ProtectedRoute from './components/common/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ComingSoon from './pages/ComingSoon';
import ProvisioningRequests from './pages/ProvisioningRequests';
import CustomerProducts from './pages/CustomerProducts';
import PendingProductRequests from './pages/PendingProductRequests';
import GhostAccounts from './pages/GhostAccounts';
import ExpirationMonitor from './pages/ExpirationMonitor';
import PSAuditTrail from './pages/PSAuditTrail';
import PackageChangesAnalytics from './pages/PackageChangesAnalytics';
import AccountHistory from './pages/AccountHistory';
import AnalyticsOverview from './pages/AnalyticsOverview';
import UserManagement from './pages/UserManagement';
import Settings from './pages/Settings';
import Help from './pages/Help';
import ApiTest from './pages/ApiTest';
import Roadmap from './pages/Roadmap';
import Catalogue from './pages/Catalogue';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Router>
              <AutoRefreshProvider>
                <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/api-test" element={<ApiTest />} />

            {/* Protected Routes with Layout */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              {/* Dashboard */}
              <Route 
                index 
                element={
                  <ProtectedRoute pageName="dashboard">
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />

              {/* Analytics */}
              <Route 
                path="analytics" 
                element={
                  <ProtectedRoute pageName="analytics.overview">
                    <AnalyticsOverview />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="analytics/account-history" 
                element={
                  <ProtectedRoute pageName="analytics.account_history">
                    <AccountHistory />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="analytics/package-changes" 
                element={
                  <ProtectedRoute pageName="analytics.package_changes">
                    <PackageChangesAnalytics />
                  </ProtectedRoute>
                } 
              />

              {/* Provisioning Monitor (with sub-pages) */}
              <Route 
                path="provisioning" 
                element={
                  <ProtectedRoute pageName="provisioning.monitor">
                    <ProvisioningRequests />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="provisioning/expiration" 
                element={
                  <ProtectedRoute pageName="provisioning.expiration">
                    <ExpirationMonitor />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="provisioning/ghost-accounts" 
                element={
                  <ProtectedRoute pageName="provisioning.ghost_accounts">
                    <GhostAccounts />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="provisioning/audit-trail" 
                element={
                  <ProtectedRoute pageName="provisioning.audit_trail">
                    <PSAuditTrail />
                  </ProtectedRoute>
                } 
              />

              {/* Customer Products (standalone) */}
              <Route 
                path="customer-products" 
                element={
                  <ProtectedRoute pageName="customer_products">
                    <CustomerProducts />
                  </ProtectedRoute>
                } 
              />
              
              {/* Pending Product Update Requests */}
              <Route 
                path="pending-product-requests" 
                element={
                  <ProtectedRoute pageName="customer_products">
                    <PendingProductRequests />
                  </ProtectedRoute>
                } 
              />

              {/* User Management */}
              <Route 
                path="users" 
                element={
                  <ProtectedRoute pageName="user_management">
                    <UserManagement />
                  </ProtectedRoute>
                } 
              />

              {/* Settings */}
              <Route 
                path="settings" 
                element={
                  <ProtectedRoute pageName="settings">
                    <Settings />
                  </ProtectedRoute>
                } 
              />

              {/* Help */}
              <Route 
                path="help" 
                element={
                  <ProtectedRoute pageName="help">
                    <Help />
                  </ProtectedRoute>
                } 
              />

              {/* Experimental Pages - Roadmap */}
              <Route 
                path="experimental/roadmap" 
                element={
                  <ProtectedRoute pageName="experimental.roadmap">
                    <Roadmap />
                  </ProtectedRoute>
                } 
              />

              {/* Experimental Pages - Catalogue (Products & Bundles) */}
              <Route 
                path="experimental/product-catalogue" 
                element={
                  <ProtectedRoute pageName="experimental.product-catalogue">
                    <Catalogue />
                  </ProtectedRoute>
                } 
              />
            </Route>

            {/* Catch-all - redirect to dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AutoRefreshProvider>
            </Router>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
