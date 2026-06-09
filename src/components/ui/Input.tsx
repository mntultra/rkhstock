import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  theme?: 'emerald' | 'blue' | 'amber' | 'rose' | 'gray';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, theme = 'emerald', className = '', ...props }, ref) => {
    
    const themeStyles = {
      emerald: "focus:ring-emerald-100 focus:border-emerald-500",
      blue: "focus:ring-blue-100 focus:border-blue-500",
      amber: "focus:ring-amber-100 focus:border-amber-500",
      rose: "focus:ring-rose-100 focus:border-rose-500",
      gray: "focus:ring-gray-100 focus:border-gray-500",
    };

    const errorStyles = error ? "border-red-400 ring-4 ring-red-50" : `border-gray-200 focus:ring-4 ${themeStyles[theme]}`;

    return (
      <div className="space-y-1.5 w-full">
        {label && <label className="block text-sm font-bold text-gray-700">{label}</label>}
        <input
          ref={ref}
          className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl outline-none transition-all text-sm font-medium shadow-sm disabled:bg-gray-100 disabled:text-gray-400 ${errorStyles} ${className}`}
          {...props}
        />
        {error && <p className="text-red-500 text-xs font-bold mt-1">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
