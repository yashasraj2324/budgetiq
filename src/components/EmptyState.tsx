"use client";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}

/** Consistent empty-state card: icon badge + title + optional description and CTA. */
export function EmptyState({ icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-space-lg ${compact ? "py-6" : "py-10"}`}>
      <span
        className={`flex items-center justify-center rounded-full bg-surface-container-low text-outline mb-space-md ${compact ? "w-9 h-9" : "w-12 h-12"}`}
      >
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </span>
      <p className="font-headline-md text-headline-md text-on-surface">{title}</p>
      {description && <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-space-md">{action}</div>}
    </div>
  );
}
