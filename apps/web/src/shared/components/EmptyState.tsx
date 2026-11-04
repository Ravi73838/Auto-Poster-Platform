import React from 'react';
import { FolderOpen } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-surface border border-border border-dashed rounded-xl">
      <div className="p-3 bg-surfaceAlt text-textSecondary rounded-full mb-4">
        <FolderOpen className="w-8 h-8" />
      </div>
      <h3 className="text-base font-semibold text-textPrimary">{title}</h3>
      {description ? (
        <p className="mt-1 text-sm text-textSecondary max-w-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

