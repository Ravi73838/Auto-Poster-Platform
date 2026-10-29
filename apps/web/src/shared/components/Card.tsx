import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'bg-surface border border-border rounded-xl p-6 shadow-sm text-textPrimary',
          className,
        ),
      )}
      {...props}
    >
      {children}
    </div>
  );
}
