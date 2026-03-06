'use client';

/**
 * Logo Trillio (ícone + marca) para uso em páginas públicas (validação de certificado, etc.).
 */
export default function TrillioLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center text-white" aria-hidden>
        <svg
          className="h-9 w-9"
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
      </span>
      <span className="text-xl font-bold text-white tracking-tight">Trillio</span>
    </div>
  );
}
