import { describe, expect, it } from 'vitest';
import {
  formatCsvAmount,
  formatCsvQuantity,
  formatCsvRate,
  formatDate,
  formatMoney,
  formatQuantity,
  formatPercent,
} from '@/lib/convert/format';

describe('formatMoney', () => {
  it('renders DE with comma decimal and currency suffix', () => {
    const out = formatMoney(1234.5, 'EUR', 'de');
    expect(out).toContain('1.234,50');
    expect(out).toContain('€');
  });

  it('renders EN with dot decimal and currency prefix', () => {
    const out = formatMoney(1234.5, 'EUR', 'en');
    expect(out).toContain('1,234.50');
    expect(out).toContain('€');
  });

  it('renders other currencies (USD) without throwing', () => {
    expect(formatMoney(10, 'USD', 'en')).toContain('10.00');
  });

  it('caches formatters across calls (same locale/currency returns same result)', () => {
    const a = formatMoney(5, 'EUR', 'de');
    const b = formatMoney(5, 'EUR', 'de');
    expect(a).toBe(b);
  });
});

describe('formatQuantity / formatPercent', () => {
  it('formats quantity with up to three decimals, localised', () => {
    expect(formatQuantity(4, 'de')).toBe('4');
    expect(formatQuantity(4.5, 'de')).toBe('4,5');
    expect(formatQuantity(4.567, 'en')).toBe('4.567');
  });

  it('formats percent with up to two decimals, localised', () => {
    expect(formatPercent(19, 'de')).toBe('19');
    expect(formatPercent(19.5, 'en')).toBe('19.5');
  });
});

describe('formatDate', () => {
  it('renders DE as dd.mm.yyyy', () => {
    expect(formatDate('2026-04-22', 'de')).toBe('22.04.2026');
  });

  it('renders EN as ISO (unambiguous)', () => {
    expect(formatDate('2026-04-22', 'en')).toBe('2026-04-22');
  });

  it('returns empty string for undefined', () => {
    expect(formatDate(undefined, 'de')).toBe('');
  });

  it('trims a datetime to date before formatting', () => {
    expect(formatDate('2026-04-22T10:00:00Z', 'de')).toBe('22.04.2026');
  });

  it('passes through a malformed value unchanged', () => {
    expect(formatDate('nope', 'de')).toBe('nope');
  });
});

describe('CSV number helpers', () => {
  it('amount always has two decimals', () => {
    expect(formatCsvAmount(10, ',')).toBe('10,00');
    expect(formatCsvAmount(10, '.')).toBe('10.00');
    expect(formatCsvAmount(1234.5, ',')).toBe('1234,50');
  });

  it('quantity trims trailing zeros', () => {
    expect(formatCsvQuantity(4, ',')).toBe('4');
    expect(formatCsvQuantity(4.5, ',')).toBe('4,5');
    expect(formatCsvQuantity(4.123, '.')).toBe('4.123');
  });

  it('rate always has two decimals', () => {
    expect(formatCsvRate(19, ',')).toBe('19,00');
    expect(formatCsvRate(7, '.')).toBe('7.00');
  });
});
