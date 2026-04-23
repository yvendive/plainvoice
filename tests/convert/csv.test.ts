// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { convertCsv, labelsFor } from '@/lib/convert';
import { FIXTURES, loadFixture } from './_fixtures';
import type { Invoice } from '@/lib/invoice';

async function asText(blob: Blob): Promise<string> {
  // Blob.text() decodes via TextDecoder which strips a leading BOM by spec.
  // Decode from the raw bytes instead so we can assert the BOM is present.
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
}

function rowsOf(text: string, withoutBom = true): string[] {
  const source = withoutBom && text.startsWith('\uFEFF') ? text.slice(1) : text;
  return source.split('\r\n').filter((l) => l.length > 0);
}

describe('convertCsv — line-items layout', () => {
  it('emits BOM, CRLF line endings, header row + one row per line', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { blob } = await convertCsv(invoice, {
      locale: 'de',
      layout: 'line-items',
      separator: ';',
      decimal: ',',
    });
    const text = await asText(blob);
    expect(text.startsWith('\uFEFF')).toBe(true);
    expect(text.includes('\r\n')).toBe(true);
    const rows = rowsOf(text);
    expect(rows).toHaveLength(1 + invoice.lines.length);
  });

  it('uses localised headers in DE', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { blob } = await convertCsv(invoice, {
      locale: 'de',
      layout: 'line-items',
      separator: ';',
      decimal: ',',
    });
    const text = await asText(blob);
    const header = rowsOf(text)[0];
    expect(header).toContain(labelsFor('de').columns.invoiceNumber);
    expect(header).toContain(labelsFor('de').columns.lineNetAmount);
  });

  it('uses localised headers in EN', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { blob } = await convertCsv(invoice, {
      locale: 'en',
      layout: 'line-items',
      separator: ';',
      decimal: '.',
    });
    const text = await asText(blob);
    const header = rowsOf(text)[0];
    expect(header).toContain(labelsFor('en').columns.invoiceNumber);
    expect(header).toContain(labelsFor('en').columns.taxRate);
  });

  it('switches decimal separator when the option flips', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const comma = await asText(
      (
        await convertCsv(invoice, {
          locale: 'de',
          layout: 'line-items',
          separator: ';',
          decimal: ',',
        })
      ).blob,
    );
    const dot = await asText(
      (
        await convertCsv(invoice, {
          locale: 'en',
          layout: 'line-items',
          separator: ';',
          decimal: '.',
        })
      ).blob,
    );
    expect(comma).toContain('50,00');
    expect(dot).toContain('50.00');
  });

  it('quotes fields that contain the separator or double quotes', async () => {
    const invoice: Invoice = {
      ...loadFixture('ubl-invoice-standard.xml'),
    };
    invoice.lines = [
      {
        ...invoice.lines[0],
        name: 'Beratung; inkl. "Workshop"',
      },
    ];
    const { blob } = await convertCsv(invoice, {
      locale: 'de',
      layout: 'line-items',
      separator: ';',
      decimal: ',',
    });
    const text = await asText(blob);
    // Separator inside field forces quoting; internal " is doubled.
    expect(text).toContain('"Beratung; inkl. ""Workshop"""');
  });

  it('quotes fields that contain newlines (payment-terms notes)', async () => {
    const invoice: Invoice = {
      ...loadFixture('ubl-invoice-standard.xml'),
      paymentTermsNote: 'Line 1\nLine 2',
    };
    const { blob } = await convertCsv(invoice, {
      locale: 'de',
      layout: 'header-only',
      separator: ';',
      decimal: ',',
    });
    const text = await asText(blob);
    expect(text).toContain('"Line 1\nLine 2"');
  });

  it('tab separator emits tab characters', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { blob } = await convertCsv(invoice, {
      locale: 'de',
      layout: 'line-items',
      separator: '\t',
      decimal: ',',
    });
    const text = await asText(blob);
    expect(text).toContain('\t');
  });

  it.each(FIXTURES)('generates CSV for %s without throwing', async (name) => {
    const invoice = loadFixture(name);
    await expect(
      convertCsv(invoice, {
        locale: 'de',
        layout: 'line-items',
        separator: ';',
        decimal: ',',
      }),
    ).resolves.toMatchObject({
      filename: expect.stringMatching(/\.csv$/),
      mimeType: 'text/csv;charset=utf-8',
    });
  });
});

describe('convertCsv — header-only layout', () => {
  it('produces a single data row with header-level amounts', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { blob } = await convertCsv(invoice, {
      locale: 'de',
      layout: 'header-only',
      separator: ';',
      decimal: ',',
    });
    const text = await asText(blob);
    const rows = rowsOf(text);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain(invoice.number);
    expect(rows[1]).toContain(invoice.paymentMeans[0]!.iban!);
  });

  it('repeats the grand total and amount due on each line-items row', async () => {
    const invoice = loadFixture('cii-mixed-rate.xml');
    const { blob } = await convertCsv(invoice, {
      locale: 'de',
      layout: 'line-items',
      separator: ';',
      decimal: ',',
    });
    const text = await asText(blob);
    const rows = rowsOf(text).slice(1);
    expect(rows).toHaveLength(invoice.lines.length);
    const amountDueFormatted = invoice.totals.amountDue.toFixed(2).replace('.', ',');
    for (const r of rows) {
      expect(r).toContain(amountDueFormatted);
    }
  });
});
