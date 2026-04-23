// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { labelsFor } from '@/lib/convert/labels';
import { convertPdf } from '@/lib/convert';
import { FIXTURES, loadFixture } from '../convert/_fixtures';

describe('allowance fallback labels', () => {
  it('DE uses Rabatt / Zuschlag', () => {
    const de = labelsFor('de').pdf;
    expect(de.allowanceFallback).toBe('Rabatt');
    expect(de.chargeFallback).toBe('Zuschlag');
  });

  it('EN uses Discount / Charge', () => {
    const en = labelsFor('en').pdf;
    expect(en.allowanceFallback).toBe('Discount');
    expect(en.chargeFallback).toBe('Charge');
  });

  it('renders to PDF without error when allowance has an empty reason (DE)', async () => {
    const base = loadFixture('ubl-invoice-standard.xml');
    const withAllowance = {
      ...base,
      allowancesCharges: [
        { isCharge: false, amount: 10, reason: '' },
        { isCharge: true, amount: 5, reason: '' },
      ],
    };
    const { blob, mimeType } = await convertPdf(withAllowance, { locale: 'de' });
    expect(mimeType).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders to PDF without error when allowance has an empty reason (EN)', async () => {
    const base = loadFixture('ubl-invoice-standard.xml');
    const withAllowance = {
      ...base,
      allowancesCharges: [{ isCharge: false, amount: 10, reason: '' }],
    };
    const { blob } = await convertPdf(withAllowance, { locale: 'en' });
    expect(blob.size).toBeGreaterThan(0);
  });
});
