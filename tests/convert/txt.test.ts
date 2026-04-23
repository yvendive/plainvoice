// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { convertTxt, labelsFor } from '@/lib/convert';
import { FIXTURES, loadFixture } from './_fixtures';

async function asText(blob: Blob): Promise<string> {
  return blob.text();
}

describe('convertTxt — basic properties', () => {
  it('uses \\r\\n line endings', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { blob } = await convertTxt(invoice, { locale: 'de' });
    const text = await asText(blob);
    expect(text.includes('\r\n')).toBe(true);
    expect(text.split('\r\n').length).toBeGreaterThan(5);
  });

  it('has DE labels in DE locale', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { blob } = await convertTxt(invoice, { locale: 'de' });
    const text = await asText(blob);
    expect(text).toContain(labelsFor('de').docTitleInvoice);
    expect(text).toContain(labelsFor('de').sections.lineItems);
    expect(text).toContain(labelsFor('de').sections.totals);
  });

  it('has EN labels in EN locale', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { blob } = await convertTxt(invoice, { locale: 'en' });
    const text = await asText(blob);
    expect(text).toContain(labelsFor('en').docTitleInvoice);
    expect(text).toContain(labelsFor('en').sections.lineItems);
  });

  it('titles credit note as "Gutschrift" in DE', async () => {
    const invoice = loadFixture('ubl-credit-note.xml');
    const { blob } = await convertTxt(invoice, { locale: 'de' });
    const text = await asText(blob);
    expect(text).toContain('Gutschrift');
    expect(text).not.toMatch(/^Rechnung/m);
  });

  it('titles credit note as "Credit note" in EN', async () => {
    const invoice = loadFixture('ubl-credit-note.xml');
    const { blob } = await convertTxt(invoice, { locale: 'en' });
    const text = await asText(blob);
    expect(text).toContain('Credit note');
  });

  it('preserves umlauts', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { blob } = await convertTxt(invoice, { locale: 'de' });
    const text = await asText(blob);
    expect(text).toContain('Verkäufer');
    expect(text).toContain('München');
  });

  it('omits empty sections (no notes, no payment)', async () => {
    const base = loadFixture('ubl-invoice-standard.xml');
    const stripped = {
      ...base,
      notes: [],
      paymentMeans: [],
      paymentTermsNote: undefined,
    };
    const { blob } = await convertTxt(stripped, { locale: 'de' });
    const text = await asText(blob);
    expect(text).not.toContain('Notizen:');
    expect(text).not.toContain('Zahlungsbedingungen:');
  });

  it('renders mixed tax breakdown with both rates', async () => {
    const invoice = loadFixture('cii-mixed-rate.xml');
    const { blob } = await convertTxt(invoice, { locale: 'de' });
    const text = await asText(blob);
    expect(text).toContain('19,00');
    expect(text).toContain('7,00');
  });

  it('includes reverse-charge exemption reason on breakdown row', async () => {
    const invoice = loadFixture('ubl-reverse-charge.xml');
    const { blob } = await convertTxt(invoice, { locale: 'en' });
    const text = await asText(blob);
    expect(text).toContain('AE');
    expect(text.toLowerCase()).toContain('reverse charge');
  });
});

describe('convertTxt — snapshots', () => {
  it.each(FIXTURES)('snapshot: %s in DE', async (name) => {
    const invoice = loadFixture(name);
    const { blob } = await convertTxt(invoice, { locale: 'de' });
    const text = await asText(blob);
    expect(text).toMatchSnapshot();
  });
});
