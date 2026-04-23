'use client';

import { useCallback, useMemo, useReducer, useState } from 'react';
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
import { FileDropZone } from './FileDropZone';
import { ConfirmationCard } from './ConfirmationCard';
import { FormatPicker } from './FormatPicker';
import { CsvOptions as CsvOptionsForm, type CsvOptionsValue } from './CsvOptions';
import { ErrorCard } from './ErrorCard';
import { ResultPanel } from './ResultPanel';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

type Status =
  | { kind: 'idle' }
  | { kind: 'parsing'; filename: string }
  | {
      kind: 'ready';
      filename: string;
      invoice: Invoice;
      warnings: ParseWarning[];
    }
  | { kind: 'generating'; filename: string; invoice: Invoice; warnings: ParseWarning[] }
  | { kind: 'done'; filename: string; byteSize: number }
  | {
      kind: 'invalid';
      error: ParseError | { kind: 'too-big' } | { kind: 'generic'; detail?: string };
    };

type Action =
  | { type: 'reset' }
  | { type: 'parse-start'; filename: string }
  | { type: 'parse-ok'; filename: string; invoice: Invoice; warnings: ParseWarning[] }
  | {
      type: 'parse-fail';
      error: ParseError | { kind: 'too-big' } | { kind: 'generic'; detail?: string };
    }
  | { type: 'convert-start' }
  | { type: 'convert-ok'; filename: string; byteSize: number }
  | { type: 'convert-fail'; detail?: string };

function reducer(state: Status, action: Action): Status {
  switch (action.type) {
    case 'reset':
      return { kind: 'idle' };
    case 'parse-start':
      return { kind: 'parsing', filename: action.filename };
    case 'parse-ok':
      return {
        kind: 'ready',
        filename: action.filename,
        invoice: action.invoice,
        warnings: action.warnings,
      };
    case 'parse-fail':
      return { kind: 'invalid', error: action.error };
    case 'convert-start':
      if (state.kind !== 'ready') return state;
      return {
        kind: 'generating',
        filename: state.filename,
        invoice: state.invoice,
        warnings: state.warnings,
      };
    case 'convert-ok':
      return { kind: 'done', filename: action.filename, byteSize: action.byteSize };
    case 'convert-fail':
      return { kind: 'invalid', error: { kind: 'generic', detail: action.detail } };
    default:
      return state;
  }
}

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

export interface ConverterProps {
  locale: Locale;
}

export function Converter({ locale }: ConverterProps) {
  const t = useTranslations('Converter');
  const [status, dispatch] = useReducer(reducer, { kind: 'idle' } as Status);

  const [format, setFormat] = useState<OutputFormat>('xlsx');

  const [csvOptions, setCsvOptions] = useState<CsvOptionsValue>({
    compatibility: 'modern',
    layout: 'line-items',
    separator: ';',
    decimal: ',',
  });

  const onFile = useCallback(
    async (file: File) => {
      dispatch({ type: 'parse-start', filename: file.name });
      try {
        const text = await file.text();
        const result = parseInvoice(text);
        if (result.ok) {
          dispatch({
            type: 'parse-ok',
            filename: file.name,
            invoice: result.invoice,
            warnings: result.warnings,
          });
        } else {
          dispatch({ type: 'parse-fail', error: result.error });
        }
      } catch (err) {
        dispatch({
          type: 'parse-fail',
          error: { kind: 'generic', detail: err instanceof Error ? err.message : String(err) },
        });
      }
    },
    [],
  );

  const onTooBig = useCallback(() => {
    dispatch({ type: 'parse-fail', error: { kind: 'too-big' } });
  }, []);

  const onReset = useCallback(() => dispatch({ type: 'reset' }), []);

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

  if (status.kind === 'idle') {
    return <FileDropZone onFile={onFile} onTooBig={onTooBig} />;
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
    return <ErrorCard error={status.error} onReset={onReset} />;
  }

  if (status.kind === 'done') {
    return (
      <ResultPanel
        filename={status.filename}
        byteSize={status.byteSize}
        onReset={onReset}
      />
    );
  }

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
