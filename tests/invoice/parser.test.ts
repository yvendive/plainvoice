import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { InvoiceSchema, parseInvoice } from '@/lib/invoice';
import type { Invoice } from '@/lib/invoice';

const sample = (name: string) =>
  readFileSync(resolve(process.cwd(), 'samples', name), 'utf-8');

const sumBreakdown = (invoice: Invoice) =>
  Math.round(invoice.taxBreakdown.reduce((acc, r) => acc + r.taxAmount, 0) * 100) / 100;

function assertOk(
  result: ReturnType<typeof parseInvoice>,
): asserts result is Extract<ReturnType<typeof parseInvoice>, { ok: true }> {
  if (!result.ok) {
    throw new Error(`Expected ok result, got error: ${JSON.stringify(result.error)}`);
  }
}

describe('parseInvoice — UBL Invoice (standard rate)', () => {
  const result = parseInvoice(sample('ubl-invoice-standard.xml'));

  it('returns ok with a schema-valid Invoice', () => {
    assertOk(result);
    expect(() => InvoiceSchema.parse(result.invoice)).not.toThrow();
  });

  it('extracts header fields', () => {
    assertOk(result);
    expect(result.invoice.number).toBe('INV-2026-0001');
    expect(result.invoice.typeCode).toBe('380');
    expect(result.invoice.issueDate).toBe('2026-04-22');
    expect(result.invoice.dueDate).toBe('2026-05-22');
    expect(result.invoice.currency).toBe('EUR');
    expect(result.invoice.buyerReference).toBe('04011000-12345-67');
    expect(result.invoice.sourceSyntax).toBe('UBL');
    expect(result.invoice.customizationId).toContain('xrechnung_3.0');
  });

  it('extracts seller, buyer, and parties', () => {
    assertOk(result);
    expect(result.invoice.seller.name).toBe('Muster Dienstleister GmbH');
    expect(result.invoice.seller.vatId).toBe('DE123456789');
    expect(result.invoice.seller.address.countryCode).toBe('DE');
    expect(result.invoice.seller.contact?.email).toBe('rechnungen@muster-dienstleister.example');
    expect(result.invoice.seller.electronicAddress?.scheme).toBe('EM');
    expect(result.invoice.buyer.name).toBe('Beispiel Behörde');
    expect(result.invoice.buyer.address.city).toBe('München');
  });

  it('extracts lines, payment means, and totals', () => {
    assertOk(result);
    expect(result.invoice.lines).toHaveLength(1);
    expect(result.invoice.lines[0].name).toBe('Beratungsleistung');
    expect(result.invoice.lines[0].quantity).toBe(4);
    expect(result.invoice.lines[0].unitCode).toBe('HUR');
    expect(result.invoice.lines[0].unitPrice).toBe(50);
    expect(result.invoice.lines[0].netAmount).toBe(200);
    expect(result.invoice.lines[0].taxCategory.code).toBe('S');
    expect(result.invoice.paymentMeans[0]?.iban).toBe('DE89370400440532013000');
    expect(result.invoice.paymentMeans[0]?.bic).toBe('COBADEFFXXX');
    expect(result.invoice.totals.amountDue).toBe(238);
    expect(result.invoice.totals.taxTotal).toBe(38);
  });

  it('has a self-consistent tax breakdown', () => {
    assertOk(result);
    expect(Math.abs(sumBreakdown(result.invoice) - result.invoice.totals.taxTotal)).toBeLessThan(
      0.01,
    );
  });

  it('captures notes and payment terms', () => {
    assertOk(result);
    expect(result.invoice.notes).toContain('Vielen Dank für Ihren Auftrag.');
    expect(result.invoice.paymentTermsNote).toContain('30 Tagen');
  });
});

describe('parseInvoice — CII CrossIndustryInvoice (standard rate)', () => {
  const result = parseInvoice(sample('cii-invoice-standard.xml'));

  it('returns ok with a schema-valid Invoice', () => {
    assertOk(result);
    expect(() => InvoiceSchema.parse(result.invoice)).not.toThrow();
  });

  it('extracts header, seller, and normalises the CII date', () => {
    assertOk(result);
    expect(result.invoice.number).toBe('INV-2026-0002');
    expect(result.invoice.typeCode).toBe('380');
    expect(result.invoice.issueDate).toBe('2026-04-22');
    expect(result.invoice.dueDate).toBe('2026-05-06');
    expect(result.invoice.currency).toBe('EUR');
    expect(result.invoice.sourceSyntax).toBe('CII');
    expect(result.invoice.seller.name).toBe('Muster Software UG');
    expect(result.invoice.seller.vatId).toBe('DE987654321');
    expect(result.invoice.seller.contact?.email).toBe('rechnungen@muster-software.example');
  });

  it('extracts the line item with unitCode and totals', () => {
    assertOk(result);
    expect(result.invoice.lines).toHaveLength(1);
    expect(result.invoice.lines[0].name).toBe('Softwareentwicklung');
    expect(result.invoice.lines[0].unitCode).toBe('HUR');
    expect(result.invoice.lines[0].quantity).toBe(10);
    expect(result.invoice.lines[0].unitPrice).toBe(90);
    expect(result.invoice.lines[0].netAmount).toBe(900);
    expect(result.invoice.totals.amountDue).toBe(1071);
    expect(result.invoice.totals.taxTotal).toBe(171);
  });

  it('has a self-consistent tax breakdown', () => {
    assertOk(result);
    expect(result.invoice.taxBreakdown).toHaveLength(1);
    expect(Math.abs(sumBreakdown(result.invoice) - result.invoice.totals.taxTotal)).toBeLessThan(
      0.01,
    );
  });

  it('captures IBAN, BIC, and payment terms', () => {
    assertOk(result);
    expect(result.invoice.paymentMeans[0]?.iban).toBe('DE89370400440532013000');
    expect(result.invoice.paymentMeans[0]?.bic).toBe('COBADEFFXXX');
    expect(result.invoice.paymentTermsNote).toContain('14 Tagen');
  });
});

describe('parseInvoice — UBL CreditNote', () => {
  const result = parseInvoice(sample('ubl-credit-note.xml'));

  it('is typed as a credit note', () => {
    assertOk(result);
    expect(result.invoice.number).toBe('CN-2026-0001');
    expect(result.invoice.typeCode).toBe('381');
    expect(result.invoice.sourceSyntax).toBe('UBL');
  });

  it('maps CreditNoteLine/CreditedQuantity into the same LineItem shape', () => {
    assertOk(result);
    expect(result.invoice.lines).toHaveLength(1);
    expect(result.invoice.lines[0].quantity).toBe(2);
    expect(result.invoice.lines[0].unitCode).toBe('HUR');
    expect(result.invoice.lines[0].netAmount).toBe(100);
  });

  it('has totals and a self-consistent tax breakdown', () => {
    assertOk(result);
    expect(result.invoice.totals.amountDue).toBe(119);
    expect(Math.abs(sumBreakdown(result.invoice) - result.invoice.totals.taxTotal)).toBeLessThan(
      0.01,
    );
  });
});

describe('parseInvoice — CII mixed-rate (19% + 7%)', () => {
  const result = parseInvoice(sample('cii-mixed-rate.xml'));

  it('returns ok with a multi-row tax breakdown', () => {
    assertOk(result);
    expect(result.invoice.taxBreakdown).toHaveLength(2);
    const rates = result.invoice.taxBreakdown.map((r) => r.category.rate).sort((a, b) => a - b);
    expect(rates).toEqual([7, 19]);
  });

  it('sum of breakdown tax equals header tax total within 0.01', () => {
    assertOk(result);
    expect(result.invoice.totals.taxTotal).toBe(197);
    expect(Math.abs(sumBreakdown(result.invoice) - result.invoice.totals.taxTotal)).toBeLessThan(
      0.01,
    );
  });

  it('maps both line items with their own rates', () => {
    assertOk(result);
    expect(result.invoice.lines).toHaveLength(2);
    expect(result.invoice.totals.amountDue).toBe(1297);
  });
});

describe('parseInvoice — UBL reverse charge (intra-EU, AE)', () => {
  const result = parseInvoice(sample('ubl-reverse-charge.xml'));

  it('carries the AE category code and 0% rate, with no VAT collected', () => {
    assertOk(result);
    expect(result.invoice.lines[0].taxCategory.code).toBe('AE');
    expect(result.invoice.lines[0].taxCategory.rate).toBe(0);
    expect(result.invoice.totals.taxTotal).toBe(0);
    expect(result.invoice.totals.amountDue).toBe(2400);
  });

  it('preserves the exemption reason on the breakdown row', () => {
    assertOk(result);
    expect(result.invoice.taxBreakdown[0]?.category.exemptionReason).toMatch(/Reverse charge/i);
  });

  it('captures buyer VAT (FR) and seller VAT (DE)', () => {
    assertOk(result);
    expect(result.invoice.seller.vatId).toBe('DE555666777');
    expect(result.invoice.buyer.vatId).toBe('FR12345678901');
    expect(result.invoice.buyer.address.countryCode).toBe('FR');
  });
});
