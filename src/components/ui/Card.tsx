import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', noPadding = false }) => {
  return (
    <div className={`bg-white rounded-3xl shadow-sm border border-gray-100 ${noPadding ? '' : 'p-6'} ${className}`}>
      {children}
    </div>
  );
};

interface CardHeaderProps {
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ title, subtitle, icon, action, className = '' }) => {
  return (
    <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-4 mb-4 ${className}`}>
      <div className="flex items-center gap-3">
        {icon && <div className="text-gray-500">{icon}</div>}
        <div>
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          {subtitle && <p className="text-sm font-medium text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};
