// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { convertCsv, convertTxt, convertXlsx } from '@/lib/convert';
import { FIXTURES, loadFixture } from './_fixtures';

describe('parseInvoice → converters — end-to-end shape', () => {
  it.each(FIXTURES)('CSV: %s produces filled ConverterResult', async (name) => {
    const invoice = loadFixture(name);
    const result = await convertCsv(invoice, {
      compatibility: 'modern',
      locale: 'de',
      layout: 'line-items',
      separator: ';',
      decimal: ',',
    });
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.byteSize).toBe(result.blob.size);
    expect(result.mimeType).toBe('text/csv;charset=utf-8');
    expect(result.filename.endsWith('.csv')).toBe(true);
  });

  it.each(FIXTURES)('TXT: %s produces filled ConverterResult', async (name) => {
    const invoice = loadFixture(name);
    const result = await convertTxt(invoice, { locale: 'en' });
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.mimeType).toBe('text/plain;charset=utf-8');
    expect(result.filename.endsWith('.txt')).toBe(true);
  });

  it.each(FIXTURES)('XLSX: %s produces filled ConverterResult', async (name) => {
    const invoice = loadFixture(name);
    const result = await convertXlsx(invoice, { locale: 'de' });
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.mimeType).toContain(
      'openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(result.filename.endsWith('.xlsx')).toBe(true);
  });
});
