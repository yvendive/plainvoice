// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { unzip } from 'fflate';
import { parseInvoice } from '@/lib/invoice';
import { bulkConvert, bulkZipFilename, type BulkConvertEntry, type BulkConvertError } from '@/lib/bulk/convert';

function loadSample(name: string): string {
  return readFileSync(resolve(process.cwd(), 'samples', name), 'utf-8');
}

function unzipBlob(blob: Blob): Promise<Record<string, Uint8Array>> {
  return blob.arrayBuffer().then(
    (buf) =>
      new Promise((res, rej) =>
        unzip(new Uint8Array(buf), (err, data) => (err ? rej(err) : res(data))),
      ),
  );
}

describe('bulkConvert', () => {
  it('produces a ZIP with one output per valid invoice + _errors.txt for failures', async () => {
    const xml1 = loadSample('ubl-invoice-standard.xml');
    const xml2 = loadSample('cii-invoice-standard.xml');
    const corruptXml = '<?xml version="1.0"?><NotAnInvoice/>';

    const parsed1 = parseInvoice(xml1);
    const parsed2 = parseInvoice(xml2);
    expect(parsed1.ok).toBe(true);
    expect(parsed2.ok).toBe(true);

    const entries: BulkConvertEntry[] = [
      { filename: 'invoice1.xml', invoice: (parsed1 as Extract<typeof parsed1, { ok: true }>).invoice, index: 0 },
      { filename: 'invoice2.xml', invoice: (parsed2 as Extract<typeof parsed2, { ok: true }>).invoice, index: 1 },
    ];

    const parseErrors: BulkConvertError[] = [
      { filename: 'corrupt.xml', error: 'not valid X-Rechnung' },
    ];

    const result = await bulkConvert(entries, parseErrors, 'csv', {
      locale: 'de',
      fallbackFilename: 'invoice',
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].filename).toBe('corrupt.xml');

    const files = await unzipBlob(result.zipBlob);
    const fileNames = Object.keys(files);
    expect(fileNames).toContain('_errors.txt');

    const csvFiles = fileNames.filter((n) => n.endsWith('.csv'));
    expect(csvFiles).toHaveLength(2);

    const errText = new TextDecoder().decode(files['_errors.txt']);
    expect(errText).toContain('corrupt.xml');
  });

  it('produces no _errors.txt when all conversions succeed', async () => {
    const xml = loadSample('ubl-invoice-standard.xml');
    const parsed = parseInvoice(xml);
    expect(parsed.ok).toBe(true);

    const entries: BulkConvertEntry[] = [
      { filename: 'invoice.xml', invoice: (parsed as Extract<typeof parsed, { ok: true }>).invoice, index: 0 },
    ];

    const result = await bulkConvert(entries, [], 'txt', {
      locale: 'en',
      fallbackFilename: 'invoice',
    });

    expect(result.errors).toHaveLength(0);
    const files = await unzipBlob(result.zipBlob);
    expect(Object.keys(files)).not.toContain('_errors.txt');
  });

  it('names output files using invoice number', async () => {
    const xml = loadSample('ubl-invoice-standard.xml');
    const parsed = parseInvoice(xml);
    expect(parsed.ok).toBe(true);
    const invoice = (parsed as Extract<typeof parsed, { ok: true }>).invoice;

    const entries: BulkConvertEntry[] = [
      { filename: 'invoice.xml', invoice, index: 0 },
    ];

    const result = await bulkConvert(entries, [], 'csv', {
      locale: 'de',
      fallbackFilename: 'invoice',
    });

    const files = await unzipBlob(result.zipBlob);
    const csvFiles = Object.keys(files).filter((n) => n.endsWith('.csv'));
    expect(csvFiles[0]).toBe(`${invoice.number}.csv`);
  });

  it('falls back to file-N.ext naming when invoice has no number', async () => {
    const xml = loadSample('ubl-invoice-standard.xml');
    const parsed = parseInvoice(xml);
    expect(parsed.ok).toBe(true);
    const invoice = (parsed as Extract<typeof parsed, { ok: true }>).invoice;
    const noNumber = { ...invoice, number: '' };

    const entries: BulkConvertEntry[] = [
      { filename: 'invoice.xml', invoice: noNumber, index: 2 },
    ];

    const result = await bulkConvert(entries, [], 'txt', {
      locale: 'de',
      fallbackFilename: 'invoice',
    });

    const files = await unzipBlob(result.zipBlob);
    expect(Object.keys(files)).toContain('file-3.txt');
  });

  it('calls onProgress for each completed entry', async () => {
    const xml = loadSample('ubl-invoice-standard.xml');
    const parsed = parseInvoice(xml);
    expect(parsed.ok).toBe(true);

    const entries: BulkConvertEntry[] = Array.from({ length: 2 }, (_, i) => ({
      filename: `f${i}.xml`,
      invoice: (parsed as Extract<typeof parsed, { ok: true }>).invoice,
      index: i,
    }));

    const calls: number[] = [];
    await bulkConvert(entries, [], 'txt', { locale: 'de', fallbackFilename: 'invoice' }, (i) =>
      calls.push(i),
    );
    expect(calls).toEqual([0, 1]);
  });
});

describe('bulkZipFilename', () => {
  it('returns a filename matching plainvoice-bulk-YYYY-MM-DD.zip', () => {
    expect(bulkZipFilename()).toMatch(/^plainvoice-bulk-\d{4}-\d{2}-\d{2}\.zip$/);
  });
});
