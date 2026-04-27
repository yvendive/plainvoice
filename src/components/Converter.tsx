'use client';

import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Invoice, ParseError, ParseWarning } from '@/lib/invoice';
import { parseInvoice } from '@/lib/invoice';
import {
  type CsvOptions,
  type Locale,
  type OutputFormat,
  convertCsv,
  convertPdf,
  convertTxt,
  convertXlsx,
} from '@/lib/convert';
import type { BulkInputResult } from '@/lib/bulk/collect';
import { bulkConvert, bulkZipFilename, type BulkConvertError } from '@/lib/bulk/convert';
import { FileDropZone } from './FileDropZone';
import { ConfirmationCard } from './ConfirmationCard';
import { FormatPicker } from './FormatPicker';
import { CsvOptions as CsvOptionsForm, type CsvOptionsValue } from './CsvOptions';
import { ErrorCard } from './ErrorCard';
import { ResultPanel } from './ResultPanel';
import { ProGate } from './ProGate';
import { BulkFileList, type BulkFileEntry } from './BulkFileList';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

// ── Status ────────────────────────────────────────────────────────────────

type Status =
  | { kind: 'idle' }
  | { kind: 'parsing'; filename: string }
  | { kind: 'ready'; filename: string; invoice: Invoice; warnings: ParseWarning[] }
  | { kind: 'generating'; filename: string; invoice: Invoice; warnings: ParseWarning[] }
  | { kind: 'done'; filename: string; byteSize: number }
  | { kind: 'invalid'; error: ParseError | { kind: 'too-big' } | { kind: 'too-many' } | { kind: 'too-large' } | { kind: 'generic'; detail?: string } }
  | { kind: 'bulk-ready'; count: number }
  | { kind: 'bulk-generating' }
  | { kind: 'bulk-done'; zipSize: number; hadErrors: boolean };

type Action =
  | { type: 'reset' }
  | { type: 'parse-start'; filename: string }
  | { type: 'parse-ok'; filename: string; invoice: Invoice; warnings: ParseWarning[] }
  | { type: 'parse-fail'; error: ParseError | { kind: 'too-big' } | { kind: 'too-many' } | { kind: 'too-large' } | { kind: 'generic'; detail?: string } }
  | { type: 'convert-start' }
  | { type: 'convert-ok'; filename: string; byteSize: number }
  | { type: 'convert-fail'; detail?: string }
  | { type: 'bulk-start'; count: number }
  | { type: 'bulk-convert-start' }
  | { type: 'bulk-done'; zipSize: number; hadErrors: boolean };

function reducer(state: Status, action: Action): Status {
  switch (action.type) {
    case 'reset':
      return { kind: 'idle' };
    case 'parse-start':
      return { kind: 'parsing', filename: action.filename };
    case 'parse-ok':
      return { kind: 'ready', filename: action.filename, invoice: action.invoice, warnings: action.warnings };
    case 'parse-fail':
      return { kind: 'invalid', error: action.error };
    case 'convert-start':
      if (state.kind !== 'ready') return state;
      return { kind: 'generating', filename: state.filename, invoice: state.invoice, warnings: state.warnings };
    case 'convert-ok':
      return { kind: 'done', filename: action.filename, byteSize: action.byteSize };
    case 'convert-fail':
      return { kind: 'invalid', error: { kind: 'generic', detail: action.detail } };
    case 'bulk-start':
      return { kind: 'bulk-ready', count: action.count };
    case 'bulk-convert-start':
      return { kind: 'bulk-generating' };
    case 'bulk-done':
      return { kind: 'bulk-done', zipSize: action.zipSize, hadErrors: action.hadErrors };
    default:
      return state;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Converter ─────────────────────────────────────────────────────────────

export interface ConverterProps {
  locale: Locale;
}

export function Converter({ locale }: ConverterProps) {
  const t = useTranslations('Converter');
  const tb = useTranslations('Bulk');
  const [status, dispatch] = useReducer(reducer, { kind: 'idle' } as Status);

  const [format, setFormat] = useState<OutputFormat>('pdf');
  const [csvOptions, setCsvOptions] = useState<CsvOptionsValue>({
    compatibility: 'modern',
    layout: 'line-items',
    separator: ';',
    decimal: ',',
  });

  // Bulk-specific state
  const [bulkEntries, setBulkEntries] = useState<BulkFileEntry[]>([]);
  const bulkParseErrorsRef = useRef<BulkConvertError[]>([]);

  const onReset = useCallback(() => {
    dispatch({ type: 'reset' });
    setBulkEntries([]);
    bulkParseErrorsRef.current = [];
  }, []);

  // ── Single-file handling ─────────────────────────────────────────────

  const parseSingleFile = useCallback(
    async (file: File) => {
      dispatch({ type: 'parse-start', filename: file.name });
      try {
        const text = await file.text();
        const result = parseInvoice(text);
        if (result.ok) {
          dispatch({ type: 'parse-ok', filename: file.name, invoice: result.invoice, warnings: result.warnings });
        } else {
          dispatch({ type: 'parse-fail', error: result.error });
        }
      } catch (err) {
        dispatch({ type: 'parse-fail', error: { kind: 'generic', detail: err instanceof Error ? err.message : String(err) } });
      }
    },
    [],
  );

  // ── Bulk handling ─────────────────────────────────────────────────────

  const parseBulkFiles = useCallback(
    async (files: File[]) => {
      const initialEntries: BulkFileEntry[] = files.map((f) => ({
        file: f,
        status: 'queued',
      }));
      setBulkEntries(initialEntries);
      dispatch({ type: 'bulk-start', count: files.length });
      bulkParseErrorsRef.current = [];

      // Mark all as parsing, then resolve each
      setBulkEntries((prev) => prev.map((e) => ({ ...e, status: 'parsing' })));

      const results = await Promise.allSettled(
        files.map(async (file) => {
          const text = await file.text();
          return parseInvoice(text);
        }),
      );

      const newErrors: BulkConvertError[] = [];
      setBulkEntries(
        results.map((result, i) => {
          const file = files[i];
          if (result.status === 'fulfilled' && result.value.ok) {
            const inv = result.value.invoice;
            return {
              file,
              status: 'ready' as const,
              invoiceNumber: inv.number || undefined,
              invoice: inv,
              warnings: result.value.warnings,
            };
          }
          const errorMsg =
            result.status === 'rejected'
              ? (result.reason instanceof Error ? result.reason.message : String(result.reason))
              : result.status === 'fulfilled' && !result.value.ok
              ? result.value.error.kind
              : 'unknown';
          newErrors.push({ filename: file.name, error: errorMsg });
          return { file, status: 'error' as const, errorMessage: errorMsg };
        }),
      );
      bulkParseErrorsRef.current = newErrors;
    },
    [],
  );

  // ── Dispatch from FileDropZone ────────────────────────────────────────

  const onFiles = useCallback(
    async (result: BulkInputResult) => {
      const { files } = result;

      if (files.length === 0) {
        dispatch({ type: 'parse-fail', error: { kind: 'generic', detail: 'No XML files found' } });
        return;
      }

      if (files.length === 1) {
        await parseSingleFile(files[0]);
        return;
      }

      await parseBulkFiles(files);
    },
    [parseSingleFile, parseBulkFiles],
  );

  const onLimitError = useCallback((kind: 'too-many' | 'too-large') => {
    dispatch({ type: 'parse-fail', error: { kind } });
  }, []);

  // ── Single-file convert ───────────────────────────────────────────────

  const handleConvert = useCallback(async () => {
    if (status.kind !== 'ready') return;
    dispatch({ type: 'convert-start' });
    try {
      const fallbackFilename = t('fallbackFilename');
      let result;
      if (format === 'csv') {
        const opts: CsvOptions = { locale, fallbackFilename, ...csvOptions };
        result = await convertCsv(status.invoice, opts);
      } else if (format === 'txt') {
        result = await convertTxt(status.invoice, { locale, fallbackFilename });
      } else if (format === 'xlsx') {
        result = await convertXlsx(status.invoice, { locale, fallbackFilename });
      } else if (format === 'pdf') {
        result = await convertPdf(status.invoice, { locale, fallbackFilename });
      } else {
        throw new Error(`format ${format} not implemented`);
      }
      triggerDownload(result.blob, result.filename);
      dispatch({ type: 'convert-ok', filename: result.filename, byteSize: result.byteSize });
    } catch (err) {
      dispatch({ type: 'convert-fail', detail: err instanceof Error ? err.message : String(err) });
    }
  }, [status, format, csvOptions, locale, t]);

  // ── Bulk convert ─────────────────────────────────────────────────────

  const handleBulkConvert = useCallback(async () => {
    const readyEntries = bulkEntries.filter((e) => e.status === 'ready');
    if (readyEntries.length === 0) return;

    dispatch({ type: 'bulk-convert-start' });

    const convertInputs = readyEntries.map((e, i) => ({
      filename: e.file.name,
      invoice: (e as BulkFileEntry & { invoice: Invoice }).invoice,
      index: i,
    }));

    setBulkEntries((prev) =>
      prev.map((e) => (e.status === 'ready' ? { ...e, status: 'queued' as const } : e)),
    );

    const { zipBlob, errors } = await bulkConvert(
      convertInputs,
      bulkParseErrorsRef.current,
      format,
      { locale, fallbackFilename: t('fallbackFilename'), ...csvOptions },
      (index) => {
        setBulkEntries((prev) => {
          const updated = [...prev];
          const readyIdx = prev.findIndex(
            (e, i) => e.status === 'queued' && i >= index,
          );
          if (readyIdx !== -1) {
            updated[readyIdx] = { ...updated[readyIdx], status: 'ready' as const };
          }
          return updated;
        });
      },
    );

    triggerDownload(zipBlob, bulkZipFilename());
    dispatch({ type: 'bulk-done', zipSize: zipBlob.size, hadErrors: errors.length > 0 });
  }, [bulkEntries, format, csvOptions, locale, t]);

  // ── Warning messages (single-file) ────────────────────────────────────

  const warningMessages = useMemo(() => {
    if (status.kind !== 'ready' && status.kind !== 'generating') return [];
    return status.warnings.map((w): string => {
      switch (w.kind) {
        case 'deprecated-version':
          return t('warningVersion');
        case 'unrecognised-version':
          return t('warningUnrecognisedVersion');
        case 'unsupported-date-format':
          return t('warningDate');
        case 'missing-optional-field':
          return t('warningMissingField', { field: w.field });
      }
    });
  }, [status, t]);

  // ── Render ────────────────────────────────────────────────────────────

  if (status.kind === 'idle') {
    return <FileDropZone onFiles={onFiles} onLimitError={onLimitError} />;
  }

  if (status.kind === 'parsing') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex w-full flex-col items-center gap-2 rounded-xl border px-8 py-16 text-center"
      >
        <Spinner />
        <p className="text-sm text-[color:var(--muted-foreground)]">{t('parsing')}</p>
      </div>
    );
  }

  if (status.kind === 'invalid') {
    const error = status.error;
    if (error.kind === 'too-many') {
      return (
        <div className="flex w-full flex-col gap-4">
          <Alert variant="warning" className="text-sm">{tb('tooMany')}</Alert>
          <Button variant="ghost" size="sm" onClick={onReset}>{t('errorRetry')}</Button>
        </div>
      );
    }
    if (error.kind === 'too-large') {
      return (
        <div className="flex w-full flex-col gap-4">
          <Alert variant="warning" className="text-sm">{tb('tooLarge')}</Alert>
          <Button variant="ghost" size="sm" onClick={onReset}>{t('errorRetry')}</Button>
        </div>
      );
    }
    return <ErrorCard error={error as ParseError | { kind: 'too-big' } | { kind: 'generic'; detail?: string }} onReset={onReset} />;
  }

  if (status.kind === 'done') {
    return <ResultPanel filename={status.filename} byteSize={status.byteSize} onReset={onReset} />;
  }

  // ── Bulk states ───────────────────────────────────────────────────────

  if (status.kind === 'bulk-done') {
    return (
      <div className="flex w-full flex-col items-center gap-4 rounded-xl border px-8 py-10 text-center">
        <p className="text-base font-semibold">{tb('doneTitle')}</p>
        {status.hadErrors && (
          <p className="text-xs text-[color:var(--muted-foreground)]">{tb('partialErrorsNote')}</p>
        )}
        <Button variant="ghost" size="sm" onClick={onReset}>{t('convertAnother')}</Button>
      </div>
    );
  }

  if (status.kind === 'bulk-ready' || status.kind === 'bulk-generating') {
    const isGenerating = status.kind === 'bulk-generating';
    const readyCount = bulkEntries.filter((e) => e.status === 'ready').length;
    const allFailed = bulkEntries.length > 0 && readyCount === 0 && bulkEntries.every((e) => e.status === 'error');

    if (allFailed) {
      return (
        <div className="flex w-full flex-col gap-4">
          <Alert variant="warning" className="text-sm">{tb('allFailed')}</Alert>
          <Button variant="ghost" size="sm" onClick={onReset}>{t('errorRetry')}</Button>
        </div>
      );
    }

    return (
      <div className="flex w-full flex-col gap-4">
        <p className="text-sm font-medium">{tb('detected', { count: bulkEntries.length })}</p>

        <BulkFileList entries={bulkEntries} />

        <FormatPicker value={format} onChange={setFormat} />
        {format === 'csv' ? <CsvOptionsForm value={csvOptions} onChange={setCsvOptions} /> : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" size="sm" onClick={onReset} disabled={isGenerating}>
            {t('errorRetry')}
          </Button>
          <ProGate>
            <Button
              size="lg"
              onClick={handleBulkConvert}
              disabled={isGenerating || readyCount === 0}
              aria-busy={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Spinner className="h-4 w-4" />
                  {t('generating')}
                </>
              ) : (
                tb('convertAll')
              )}
            </Button>
          </ProGate>
        </div>
      </div>
    );
  }

  // ── Single-file ready / generating ───────────────────────────────────

  const isGenerating = status.kind === 'generating';

  return (
    <div className="flex w-full flex-col gap-4">
      <ConfirmationCard filename={status.filename} invoice={status.invoice} locale={locale} />

      {warningMessages.length > 0 ? (
        <div className="flex flex-col gap-2">
          {warningMessages.map((msg, idx) => (
            <Alert key={idx} variant="warning" className="text-xs">
              {msg}
            </Alert>
          ))}
        </div>
      ) : null}

      <FormatPicker value={format} onChange={setFormat} />
      {format === 'csv' ? <CsvOptionsForm value={csvOptions} onChange={setCsvOptions} /> : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" onClick={onReset} disabled={isGenerating}>
          {t('errorRetry')}
        </Button>
        <Button
          size="lg"
          onClick={handleConvert}
          disabled={isGenerating}
          aria-busy={isGenerating}
        >
          {isGenerating ? (
            <>
              <Spinner className="h-4 w-4" />
              {t('generating')}
            </>
          ) : (
            t('convertButton')
          )}
        </Button>
      </div>
    </div>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={
        'inline-block h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--border)] border-t-[color:var(--accent)] ' +
        (className ?? '')
      }
    />
  );
}
