// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { convertPdf, labelsFor } from '@/lib/convert';
import { formatIban } from '@/lib/convert/pdf/sections/payment';
import { wrapText } from '@/lib/convert/pdf/draw';
import { mapUnitCode, hasReverseCharge } from '@/lib/convert/pdf/context';
import { FIXTURES, loadFixture } from './_fixtures';

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function asciiPrefix(bytes: Uint8Array, n: number): string {
  return new TextDecoder('ascii').decode(bytes.slice(0, n));
}

function asciiSuffix(bytes: Uint8Array, n: number): string {
  return new TextDecoder('ascii').decode(bytes.slice(-n));
}

describe('convertPdf — byte-level sanity', () => {
  it('begins with %PDF-1. and ends with %%EOF', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { blob } = await convertPdf(invoice, { locale: 'de', fallbackFilename: 'invoice' });
    const bytes = await bytesOf(blob);
    expect(asciiPrefix(bytes, 7)).toMatch(/^%PDF-1\./);
    expect(asciiSuffix(bytes, 6)).toMatch(/%%EOF\s*$/);
  });

  it('MIME type is application/pdf', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { mimeType, blob } = await convertPdf(invoice, { locale: 'de' });
    expect(mimeType).toBe('application/pdf');
    expect(blob.type).toBe('application/pdf');
  });

  it('filename uses invoice number and .pdf extension', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { filename } = await convertPdf(invoice, { locale: 'de' });
    expect(filename.endsWith('.pdf')).toBe(true);
    expect(filename).toContain(invoice.number);
  });

  it('respects fallbackFilename when invoice number is absent', async () => {
    const invoice = { ...loadFixture('ubl-invoice-standard.xml'), number: '' };
    const { filename } = await convertPdf(invoice, {
      locale: 'en',
      fallbackFilename: 'custom-name',
    });
    expect(filename).toBe('custom-name.pdf');
  });

  it('size lands within sensible bounds for a single-line invoice', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { byteSize, blob } = await convertPdf(invoice, { locale: 'de' });
    expect(byteSize).toBe(blob.size);
    expect(byteSize).toBeGreaterThan(20_000);
    expect(byteSize).toBeLessThan(200_000);
  });
});

describe('convertPdf — structural inspection', () => {
  it('page size equals A4 portrait (595.28 × 841.89 pt)', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { blob } = await convertPdf(invoice, { locale: 'de' });
    const bytes = await bytesOf(blob);
    const loaded = await PDFDocument.load(bytes);
    const [page] = loaded.getPages();
    expect(page.getWidth()).toBeCloseTo(595.28, 2);
    expect(page.getHeight()).toBeCloseTo(841.89, 2);
  });

  it('single-line fixtures render on a single page', async () => {
    for (const name of FIXTURES) {
      const invoice = loadFixture(name);
      const { blob } = await convertPdf(invoice, { locale: 'de' });
      const loaded = await PDFDocument.load(await bytesOf(blob));
      expect(loaded.getPageCount(), `fixture ${name}`).toBe(1);
    }
  });

  it('embeds two fonts (Inter Regular + Bold)', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { blob } = await convertPdf(invoice, { locale: 'de' });
    const loaded = await PDFDocument.load(await bytesOf(blob));
    // Re-save without object streams so font BaseFont names are visible in plaintext.
    const resaved = await loaded.save({ useObjectStreams: false });
    const raw = new TextDecoder('latin1').decode(resaved);
    const baseFonts = [...raw.matchAll(/\/BaseFont \/([A-Za-z0-9+_-]+)/g)].map((m) => m[1]);
    const interFonts = baseFonts.filter((n) => /Inter/i.test(n));
    expect(interFonts.some((n) => /Regular/i.test(n))).toBe(true);
    expect(interFonts.some((n) => /Bold/i.test(n))).toBe(true);
  });
});

describe('convertPdf — metadata (DE)', () => {
  it('sets Title to the invoice number, Author to seller name, Subject to localised doc type', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { blob } = await convertPdf(invoice, { locale: 'de' });
    const loaded = await PDFDocument.load(await bytesOf(blob));
    expect(loaded.getTitle()).toBe(invoice.number);
    expect(loaded.getAuthor()).toBe(invoice.seller.name);
    expect(loaded.getSubject()).toBe(labelsFor('de').docTitleInvoice);
    expect(loaded.getCreator()).toBe('Plainvoice');
  });

  it('credit-note fixture uses "Gutschrift" as Subject in DE and "Credit note" in EN', async () => {
    const invoice = loadFixture('ubl-credit-note.xml');

    const de = await convertPdf(invoice, { locale: 'de' });
    const deLoaded = await PDFDocument.load(await bytesOf(de.blob));
    expect(deLoaded.getSubject()).toBe('Gutschrift');

    const en = await convertPdf(invoice, { locale: 'en' });
    const enLoaded = await PDFDocument.load(await bytesOf(en.blob));
    expect(enLoaded.getSubject()).toBe('Credit note');
  });

  it('reverse-charge fixture marks the PDF via Keywords metadata', async () => {
    const invoice = loadFixture('ubl-reverse-charge.xml');
    const { blob } = await convertPdf(invoice, { locale: 'de' });
    const loaded = await PDFDocument.load(await bytesOf(blob));
    expect(loaded.getKeywords() ?? '').toContain('reverse-charge');
  });

  it('non-reverse-charge invoice does not carry the reverse-charge keyword', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { blob } = await convertPdf(invoice, { locale: 'de' });
    const loaded = await PDFDocument.load(await bytesOf(blob));
    expect(loaded.getKeywords() ?? '').not.toContain('reverse-charge');
  });
});

describe('convertPdf — pagination', () => {
  it('paginates to ≥ 2 pages for an 80-line invoice', async () => {
    const base = loadFixture('ubl-invoice-standard.xml');
    const firstLine = base.lines[0];
    const manyLines = Array.from({ length: 80 }, (_, i) => ({
      ...firstLine,
      id: String(i + 1),
    }));
    const fat = { ...base, lines: manyLines };

    const { blob } = await convertPdf(fat, { locale: 'de' });
    const loaded = await PDFDocument.load(await bytesOf(blob));
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});

describe('helpers — pure units', () => {
  it('formatIban groups uppercase digits into quads separated by spaces', () => {
    expect(formatIban('de89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00');
    expect(formatIban('  DE8937040044 0532 013000')).toBe('DE89 3704 0044 0532 0130 00');
    expect(formatIban('')).toBe('');
  });

  it('mapUnitCode translates codes and falls through on unknowns', () => {
    const de = labelsFor('de');
    const en = labelsFor('en');
    expect(mapUnitCode('HUR', de)).toBe('Std.');
    expect(mapUnitCode('HUR', en)).toBe('h');
    expect(mapUnitCode('XPP', de)).toBe('Stk.');
    expect(mapUnitCode('C62', en)).toBe('units');
    expect(mapUnitCode('DAY', de)).toBe('DAY');
  });

  it('hasReverseCharge detects AE in either lines or tax breakdown', () => {
    expect(hasReverseCharge(loadFixture('ubl-reverse-charge.xml'))).toBe(true);
    expect(hasReverseCharge(loadFixture('ubl-invoice-standard.xml'))).toBe(false);
    expect(hasReverseCharge(loadFixture('ubl-credit-note.xml'))).toBe(false);
    expect(hasReverseCharge(loadFixture('cii-mixed-rate.xml'))).toBe(false);
  });

  it('wrapText splits on hard newlines and word-wraps to max width', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont('Helvetica' as unknown as import('pdf-lib').StandardFonts);
    // Word-wrap within a paragraph
    const lines = wrapText('foo bar baz qux', 30, font, 12);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0]).toContain('foo');
    // Hard newlines are preserved as separate paragraphs
    const hard = wrapText('line one\nline two\n\nline four', 200, font, 9);
    expect(hard).toEqual(['line one', 'line two', '', 'line four']);
    // A single word longer than maxWidth becomes its own line
    const long = wrapText('abcdefghijklmnop', 10, font, 12);
    expect(long).toEqual(['abcdefghijklmnop']);
  });
});
