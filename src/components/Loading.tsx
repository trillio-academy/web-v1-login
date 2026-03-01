'use client';

import React from 'react';

export interface LoadingProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  fullScreen?: boolean;
}

const sizeMap = {
  small: { spinner: 24, container: 'p-4' },
  medium: { spinner: 40, container: 'p-8' },
  large: { spinner: 64, container: 'p-12' },
};

const TrillioLogoSvg = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

export default function Loading({ size = 'medium', text = 'Carregando...', fullScreen = false }: LoadingProps) {
  const currentSize = sizeMap[size];
  const s = currentSize.spinner;

  return (
    <div
      className={
        fullScreen
          ? 'flex flex-col justify-center items-center min-h-screen bg-[#0d1117] text-[#f0f6fc]'
          : `flex flex-col justify-center items-center text-center ${currentSize.container}`
      }
    >
      <div
        className="relative inline-block flex-shrink-0"
        style={{ width: s, height: s }}
      >
        {/* Anel que gira */}
        <div
          className="absolute inset-0 rounded-full border-[3px] border-[#21262d]"
          style={{
            borderTopColor: '#f85149',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        {/* Logo Trillio no centro com pulse sutil */}
        <div
          className="absolute inset-0 flex items-center justify-center text-[#f85149] animate-pulse"
          style={{
            transform: 'scale(0.5)',
            filter: 'drop-shadow(0 0 4px rgba(248, 81, 73, 0.35))',
          }}
        >
          <TrillioLogoSvg />
        </div>
      </div>
      {text && (
        <p className="mt-5 text-sm font-normal text-[#8b949e] tracking-wide">
          {text}
        </p>
      )}
    </div>
  );
}
