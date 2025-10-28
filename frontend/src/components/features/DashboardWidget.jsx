import React from 'react';

/**
 * Reusable Dashboard Widget Container
 * Provides consistent styling and structure for all dashboard widgets
 */
const DashboardWidget = ({ 
  title, 
  icon, 
  children, 
  className = '' 
}) => {
  return (
    <div className={`rounded-lg border bg-white shadow-sm p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        {icon && <span className="text-2xl">{icon}</span>}
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
};

export default DashboardWidget;













