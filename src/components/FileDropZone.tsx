'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { collectFromDrop, collectFromInput, type BulkInputResult } from '@/lib/bulk/collect';

export interface FileDropZoneProps {
  onFiles: (result: BulkInputResult) => void;
  onLimitError: (kind: 'too-many' | 'too-large') => void;
  disabled?: boolean;
}

export function FileDropZone({ onFiles, onLimitError, disabled = false }: FileDropZoneProps) {
  const t = useTranslations('Converter');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleResult = useCallback(
    (result: BulkInputResult) => {
      if (result.files.length === 0 && result.errors.length === 0) return;
      onFiles(result);
    },
    [onFiles],
  );

  const onDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      if (disabled) return;
      try {
        const result = await collectFromDrop(event.dataTransfer);
        handleResult(result);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'BulkLimitError') {
          onLimitError((err as Error & { kind: string }).kind as 'too-many' | 'too-large');
        }
      }
    },
    [disabled, handleResult, onLimitError],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) setDragActive(true);
  }, [disabled]);

  const onDragLeave = useCallback(() => setDragActive(false), []);

  const openPicker = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPicker();
      }
    },
    [disabled, openPicker],
  );

  const onInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const filesArray = event.target.files
        ? Array.from(event.target.files)
        : [];
      event.target.value = '';
      if (filesArray.length === 0) return;
      try {
        const result = await collectFromInput(filesArray);
        handleResult(result);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'BulkLimitError') {
          onLimitError((err as Error & { kind: string }).kind as 'too-many' | 'too-large');
        }
      }
    },
    [handleResult, onLimitError],
  );

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={t('dropzoneTitle')}
      aria-disabled={disabled}
      onClick={openPicker}
      onKeyDown={onKeyDown}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      data-testid="dropzone"
      className={cn(
        'flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-8 py-16 text-center transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2',
        disabled && 'cursor-not-allowed opacity-60',
        !disabled && dragActive
          ? 'border-[color:var(--accent)] bg-[color:var(--muted)]'
          : 'border-[color:var(--border)] hover:border-[color:var(--accent)]/60',
      )}
    >
      <p className="text-base font-medium">{t('dropzoneTitle')}</p>
      <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{t('dropzoneOr')}</p>
      <span className="mt-3 inline-flex items-center rounded-md bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white">
        {t('dropzoneBrowse')}
      </span>
      <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">{t('dropzoneHint')}</p>
      <input
        ref={inputRef}
        type="file"
        accept=".xml,.zip,application/xml,text/xml,application/zip"
        multiple
        className="sr-only"
        disabled={disabled}
        onChange={onInputChange}
      />
    </div>
  );
}
