import { strToU8, zipSync } from 'fflate';
import type { Invoice } from '@/lib/invoice';
import type { CsvOptions, Locale, OutputFormat } from '@/lib/convert';
import { convertCsv, convertPdf, convertTxt, convertXlsx } from '@/lib/convert';

export interface BulkConvertEntry {
  filename: string;
  invoice: Invoice;
  index: number;
}

export interface BulkConvertError {
  filename: string;
  error: string;
}

export interface BulkConvertResult {
  zipBlob: Blob;
  errors: BulkConvertError[];
}

async function convertOne(
  invoice: Invoice,
  format: OutputFormat,
  options: { locale: Locale; fallbackFilename: string } & Partial<CsvOptions>,
): Promise<{ blob: Blob; filename: string }> {
  if (format === 'csv') {
    return convertCsv(invoice, {
      locale: options.locale,
      fallbackFilename: options.fallbackFilename,
      layout: options.layout ?? 'line-items',
      separator: options.separator ?? ';',
      decimal: options.decimal ?? ',',
      compatibility: options.compatibility ?? 'modern',
    });
  }
  if (format === 'txt') return convertTxt(invoice, options);
  if (format === 'xlsx') return convertXlsx(invoice, options);
  return convertPdf(invoice, options);
}

function outputName(invoice: Invoice, ext: string, index: number): string {
  return invoice.number ? `${invoice.number}.${ext}` : `file-${index + 1}.${ext}`;
}

export async function bulkConvert(
  entries: BulkConvertEntry[],
  parseErrors: BulkConvertError[],
  format: OutputFormat,
  options: { locale: Locale; fallbackFilename: string } & Partial<CsvOptions>,
  onProgress?: (index: number) => void,
): Promise<BulkConvertResult> {
  const zipFiles: Record<string, Uint8Array> = {};
  const convertErrors: BulkConvertError[] = [];

  for (let i = 0; i < entries.length; i++) {
    const { invoice, filename, index } = entries[i];
    try {
      const result = await convertOne(invoice, format, options);
      const ext = format;
      const name = outputName(invoice, ext, index);
      zipFiles[name] = new Uint8Array(await result.blob.arrayBuffer());
      onProgress?.(i);
    } catch (err) {
      convertErrors.push({
        filename,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const allErrors = [...parseErrors, ...convertErrors];
  if (allErrors.length > 0) {
    const lines = allErrors.map((e) => `${e.filename}: ${e.error}`).join('\n');
    zipFiles['_errors.txt'] = strToU8(lines);
  }

  const zipped = zipSync(zipFiles);
  return {
    zipBlob: new Blob([zipped as unknown as Uint8Array<ArrayBuffer>], { type: 'application/zip' }),
    errors: allErrors,
  };
}

export function bulkZipFilename(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `plainvoice-bulk-${ymd}.zip`;
}
