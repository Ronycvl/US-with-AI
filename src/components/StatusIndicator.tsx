import React from 'react';
import { TankStatus } from '../lib/plantLogic';

interface StatusIndicatorProps {
  status: TankStatus;
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, label, size = 'sm' }) => {
  const textSize = size === 'md' ? 'text-sm' : 'text-xs';

  if (status === 'critical') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-semibold text-red-700 dark:text-red-400 ${textSize} whitespace-nowrap shrink-0`}>
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" aria-hidden="true">
          <polygon points="8,1 15,8 8,15 1,8" fill="currentColor" />
        </svg>
        <span>{label ?? 'Threshold met'}</span>
      </span>
    );
  }

  if (status === 'moderate') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400 ${textSize} whitespace-nowrap shrink-0`}>
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" aria-hidden="true">
          <polygon points="8,2 15,14 1,14" fill="currentColor" />
        </svg>
        <span>{label ?? 'Moderate'}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold text-green-700 dark:text-green-400 ${textSize} whitespace-nowrap shrink-0`}>
      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6" fill="currentColor" />
      </svg>
      <span>{label ?? 'Normal'}</span>
    </span>
  );
};
