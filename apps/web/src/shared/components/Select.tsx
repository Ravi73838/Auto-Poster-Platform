import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={selectId} className="block text-xs font-semibold text-textSecondary mb-1.5">
            {label}
          </label>
        ) : null}
        <select
          ref={ref}
          id={selectId}
          className={twMerge(
            clsx(
              'w-full px-3.5 py-2 text-sm bg-surface border rounded-lg text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors',
              error ? 'border-danger focus:ring-danger' : 'border-border',
              className,
            ),
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-surface text-textPrimary">
              {opt.label}
            </option>
          ))}
        </select>
        {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      </div>
    );
  },
);

Select.displayName = 'Select';
