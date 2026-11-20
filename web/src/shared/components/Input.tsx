import React, { forwardRef, useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Eye, EyeOff } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  showPasswordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, type, showPasswordToggle, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const isPassword = type === 'password';
    const hasToggle = isPassword && showPasswordToggle !== false;
    const computedType = isPassword && hasToggle ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={inputId} className="block text-xs font-semibold text-textSecondary mb-1.5">
            {label}
          </label>
        ) : null}
        <div className="relative w-full">
          <input
            ref={ref}
            id={inputId}
            type={computedType}
            className={twMerge(
              clsx(
                'w-full px-3.5 py-2 text-sm bg-surface border rounded-lg text-textPrimary placeholder:text-textSecondary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors',
                hasToggle ? 'pr-10' : '',
                error ? 'border-danger focus:ring-danger' : 'border-border',
                className,
              ),
            )}
            {...props}
          />
          {hasToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-textSecondary hover:text-textPrimary transition-colors focus:outline-none rounded cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4 shrink-0" />
              ) : (
                <Eye className="w-4 h-4 shrink-0" />
              )}
            </button>
          )}
        </div>
        {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
