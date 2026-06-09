import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface AlertProps {
  message?: string;
  children?: React.ReactNode;
  type?: 'success' | 'warning' | 'error' | 'info';
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({ message, children, type = 'success', className = '' }) => {
  if (!message && !children) return null;

  const styles = {
    success: {
      bg: "bg-emerald-50 border-emerald-200 text-emerald-800",
      icon: <CheckCircle2 className="text-emerald-500 shrink-0" size={24} />
    },
    warning: {
      bg: "bg-amber-50 border-amber-200 text-amber-800",
      icon: <AlertTriangle className="text-amber-500 shrink-0" size={24} />
    },
    error: {
      bg: "bg-rose-50 border-rose-200 text-rose-800",
      icon: <AlertCircle className="text-rose-500 shrink-0" size={24} />
    },
    info: {
      bg: "bg-blue-50 border-blue-200 text-blue-800",
      icon: <Info className="text-blue-500 shrink-0" size={24} />
    }
  };

  return (
    <div className={`border px-6 py-4 rounded-2xl flex items-start gap-3 shadow-sm animate-fade-in-up ${styles[type].bg} ${className}`}>
      <div className="mt-0.5">{styles[type].icon}</div>
      <div className="flex-1">
        {message && <span className="font-extrabold">{message}</span>}
        {children}
      </div>
    </div>
  );
};
