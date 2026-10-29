import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={inputId} className="block text-xs font-semibold text-textSecondary mb-1.5">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={twMerge(
            clsx(
              'w-full px-3.5 py-2 text-sm bg-surface border rounded-lg text-textPrimary placeholder:text-textSecondary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors',
              error ? 'border-danger focus:ring-danger' : 'border-border',
              className,
            ),
          )}
          {...props}
        />
        {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
