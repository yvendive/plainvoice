import { describe, expect, it } from 'vitest';
import { labelsFor } from '@/lib/convert';

describe('labelsFor', () => {
  it('returns DE by default path', () => {
    const L = labelsFor('de');
    expect(L.docTitleInvoice).toBe('Rechnung');
    expect(L.columns.invoiceNumber).toBe('Rechnungsnummer');
  });

  it('returns EN with expected strings', () => {
    const L = labelsFor('en');
    expect(L.docTitleInvoice).toBe('Invoice');
    expect(L.columns.invoiceNumber).toBe('Invoice number');
  });

  it('DE and EN bundles share the same keys', () => {
    const de = labelsFor('de');
    const en = labelsFor('en');
    expect(Object.keys(de.columns)).toEqual(Object.keys(en.columns));
    expect(Object.keys(de.sections)).toEqual(Object.keys(en.sections));
    expect(Object.keys(de.fields)).toEqual(Object.keys(en.fields));
    expect(Object.keys(de.sheets)).toEqual(Object.keys(en.sheets));
  });
});
