'use client';

import { useTranslations } from 'next-intl';

export type BulkFileStatus = 'queued' | 'parsing' | 'ready' | 'error';

export interface BulkFileEntry {
  file: File;
  status: BulkFileStatus;
  invoiceNumber?: string;
  errorMessage?: string;
}

interface BulkFileListProps {
  entries: BulkFileEntry[];
}

function StatusIcon({ status, label }: { status: BulkFileStatus; label: string }) {
  if (status === 'queued') {
    return (
      <span aria-label={label} className="inline-block h-2 w-2 rounded-full bg-[color:var(--muted-foreground)]" />
    );
  }
  if (status === 'parsing') {
    return (
      <span
        aria-label={label}
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--border)] border-t-[color:var(--accent)]"
      />
    );
  }
  if (status === 'ready') {
    return (
      <svg aria-label={label} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="2,8 6,12 14,4" />
      </svg>
    );
  }
  // error
  return (
    <svg aria-label={label} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 2L14 13H2L8 2z" />
      <line x1="8" y1="7" x2="8" y2="10" />
      <circle cx="8" cy="12" r="0.5" fill="currentColor" />
    </svg>
  );
}

export function BulkFileList({ entries }: BulkFileListProps) {
  const t = useTranslations('Bulk');

  const readyCount = entries.filter((e) => e.status === 'ready').length;
  const total = entries.length;
  const progressPct = total > 0 ? Math.round((readyCount / total) * 100) : 0;

  const statusLabel: Record<BulkFileStatus, string> = {
    queued: t('fileStatusQueued'),
    parsing: t('fileStatusParsing'),
    ready: t('fileStatusReady'),
    error: t('fileStatusError'),
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-[color:var(--muted-foreground)]">
        <span>{t('progress', { ready: readyCount, total })}</span>
        <span>{progressPct}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={readyCount}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuetext={t('progress', { ready: readyCount, total })}
        className="h-1.5 w-full rounded-full bg-[color:var(--muted)]"
      >
        <div
          className="h-full rounded-full bg-[color:var(--accent)] transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <ul className="flex flex-col divide-y divide-[color:var(--border)] rounded-xl border">
        {entries.map((entry, i) => (
          <li
            key={i}
            role="listitem"
            className="flex items-center gap-3 px-4 py-2.5 text-sm"
          >
            <StatusIcon status={entry.status} label={statusLabel[entry.status]} />
            <span className="flex-1 truncate font-mono text-xs">{entry.file.name}</span>
            {entry.invoiceNumber && (
              <span className="shrink-0 text-xs text-[color:var(--muted-foreground)]">
                {entry.invoiceNumber}
              </span>
            )}
            {entry.status === 'error' && entry.errorMessage && (
              <span
                title={entry.errorMessage}
                className="shrink-0 max-w-[120px] truncate text-xs text-red-500"
              >
                {entry.errorMessage}
              </span>
            )}
            <span className="shrink-0 text-xs text-[color:var(--muted-foreground)]">
              {Math.round(entry.file.size / 1024)} KB
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
