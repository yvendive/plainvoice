'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useToast } from './Toast';

export function FileDropZone() {
  const t = useTranslations('Converter');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const showToast = useToast();

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      console.log('[Plainvoice] file selected (M1 placeholder):', file.name, file.size);
      showToast({
        title: t('comingSoonTitle'),
        description: t('comingSoonBody'),
        variant: 'info',
      });
    },
    [showToast, t],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback(() => setDragActive(false), []);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPicker();
      }
    },
    [openPicker],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t('dropzoneTitle')}
      onClick={openPicker}
      onKeyDown={onKeyDown}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={cn(
        'flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-8 py-16 text-center transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2',
        dragActive
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
        accept=".xml,application/xml,text/xml"
        className="sr-only"
        onChange={(event) => handleFiles(event.target.files)}
      />
    </div>
  );
}
