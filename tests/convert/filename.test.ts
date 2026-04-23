import { describe, expect, it } from 'vitest';
import { invoiceFilename } from '@/lib/convert';
import type { Invoice } from '@/lib/invoice';

function stub(number: string): Invoice {
  return {
    number,
    typeCode: '380',
    issueDate: '2026-01-01',
    currency: 'EUR',
    notes: [],
    seller: { name: 'S', address: { countryCode: 'DE' } },
    buyer: { name: 'B', address: { countryCode: 'DE' } },
    lines: [],
    allowancesCharges: [],
    taxBreakdown: [],
    totals: {
      lineNetTotal: 0,
      allowanceTotal: 0,
      chargeTotal: 0,
      taxExclusive: 0,
      taxTotal: 0,
      taxInclusive: 0,
      paidAmount: 0,
      roundingAmount: 0,
      amountDue: 0,
    },
    paymentMeans: [],
    sourceSyntax: 'UBL',
  } as Invoice;
}

describe('invoiceFilename', () => {
  it('keeps safe characters and appends extension', () => {
    expect(invoiceFilename(stub('INV-2026-0001'), 'csv')).toBe('INV-2026-0001.csv');
  });

  it('replaces unsafe characters with underscore and trims trailing separators', () => {
    expect(invoiceFilename(stub('INV/2026 #1?'), 'txt')).toBe('INV_2026_1.txt');
  });

  it('collapses runs of underscores', () => {
    expect(invoiceFilename(stub('A   B///C'), 'xlsx')).toBe('A_B_C.xlsx');
  });

  it('trims leading and trailing separators', () => {
    expect(invoiceFilename(stub('___INV-1___'), 'csv')).toBe('INV-1.csv');
  });

  it('truncates at 80 characters before extension', () => {
    const long = 'A'.repeat(120);
    const result = invoiceFilename(stub(long), 'pdf');
    expect(result.length).toBeLessThanOrEqual(80 + '.pdf'.length);
    expect(result.endsWith('.pdf')).toBe(true);
  });

  it('falls back to caller-supplied fallback when sanitised base is empty', () => {
    expect(invoiceFilename(stub('   '), 'csv', 'rechnung')).toBe('rechnung.csv');
  });

  it('falls back to default "invoice" when no fallback given', () => {
    expect(invoiceFilename(stub(''), 'csv')).toBe('invoice.csv');
  });

  it('falls back even when fallback itself has unsafe chars, landing on "invoice"', () => {
    expect(invoiceFilename(stub(''), 'csv', '///')).toBe('invoice.csv');
  });
});
