import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast from '../components/common/Toast';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback(({ title, message, duration, actionLabel, onAction }) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newToast = {
      id,
      title,
      message,
      duration,
      actionLabel,
      onAction,
    };

    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast, clearAllToasts }}>
      {children}
      
      {/* Toast Container */}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 z-50 flex flex-col items-end px-4 py-6 sm:items-end sm:p-6 space-y-4"
      >
        <div className="flex w-full flex-col items-end space-y-4">
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              {...toast}
              onClose={removeToast}
            />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
};

