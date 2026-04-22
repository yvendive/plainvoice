import { describe, expect, it } from 'vitest';
import { asArray, asText, parseCiiDate, roundCents, toAmount, toIsoDate } from '@/lib/invoice/helpers';
import type { ParseWarning } from '@/lib/invoice';

describe('asArray', () => {
  it('returns [] for undefined/null', () => {
    expect(asArray(undefined)).toEqual([]);
    expect(asArray(null)).toEqual([]);
  });
  it('wraps singletons and passes arrays through', () => {
    expect(asArray('x')).toEqual(['x']);
    expect(asArray(['a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('asText', () => {
  it('stringifies numbers and booleans', () => {
    expect(asText(42)).toBe('42');
    expect(asText(true)).toBe('true');
  });
  it('reads #text off attribute-bearing nodes', () => {
    expect(asText({ '#text': 'hello', currencyID: 'EUR' })).toBe('hello');
  });
  it('returns undefined for empty/unknown objects', () => {
    expect(asText({})).toBeUndefined();
    expect(asText(undefined)).toBeUndefined();
    expect(asText(null)).toBeUndefined();
  });
});

describe('toAmount', () => {
  it('parses dot-decimal and integer strings', () => {
    expect(toAmount('1234.56')).toBe(1234.56);
    expect(toAmount('100')).toBe(100);
  });
  it('tolerates the DE locale with comma as decimal', () => {
    expect(toAmount('99,00')).toBe(99);
  });
  it('tolerates US thousand-separators', () => {
    expect(toAmount('1,234.56')).toBe(1234.56);
  });
  it('returns undefined for empty/non-numeric input', () => {
    expect(toAmount('')).toBeUndefined();
    expect(toAmount(undefined)).toBeUndefined();
    expect(toAmount('not-a-number')).toBeUndefined();
  });
});

describe('parseCiiDate', () => {
  it('handles the canonical format="102" CCYYMMDD', () => {
    const warnings: ParseWarning[] = [];
    expect(
      parseCiiDate({ format: '102', '#text': '20260422' }, { field: 'issueDate', warnings }),
    ).toBe('2026-04-22');
    expect(warnings).toHaveLength(0);
  });
  it('defaults to "102" when no format attribute is present', () => {
    const warnings: ParseWarning[] = [];
    expect(parseCiiDate('20260422', { field: 'issueDate', warnings })).toBe('2026-04-22');
  });
  it('widens format="610" CCYYMM to day 01 with a warning', () => {
    const warnings: ParseWarning[] = [];
    const result = parseCiiDate(
      { format: '610', '#text': '202604' },
      { field: 'issueDate', warnings },
    );
    expect(result).toBe('2026-04-01');
    expect(warnings).toEqual([
      { kind: 'unsupported-date-format', format: '610', raw: '202604' },
    ]);
  });
  it('warns and returns undefined for unsupported formats', () => {
    const warnings: ParseWarning[] = [];
    expect(
      parseCiiDate(
        { format: '999', '#text': '20260422' },
        { field: 'issueDate', warnings },
      ),
    ).toBeUndefined();
    expect(warnings[0]?.kind).toBe('unsupported-date-format');
  });
  it('returns undefined for empty / malformed input', () => {
    const warnings: ParseWarning[] = [];
    expect(parseCiiDate(undefined, { field: 'issueDate', warnings })).toBeUndefined();
    expect(
      parseCiiDate({ format: '102', '#text': 'abcd' }, { field: 'issueDate', warnings }),
    ).toBeUndefined();
    expect(
      parseCiiDate({ format: '610', '#text': 'xx' }, { field: 'issueDate', warnings }),
    ).toBeUndefined();
  });
});

describe('toIsoDate', () => {
  it('passes ISO dates through unchanged', () => {
    expect(toIsoDate('2026-04-22')).toBe('2026-04-22');
  });
  it('trims ISO datetimes down to the date portion', () => {
    expect(toIsoDate('2026-04-22T10:15:00+02:00')).toBe('2026-04-22');
    expect(toIsoDate('2026-04-22 10:15:00')).toBe('2026-04-22');
  });
  it('returns undefined for empty / invalid input', () => {
    expect(toIsoDate(undefined)).toBeUndefined();
    expect(toIsoDate('not-a-date')).toBeUndefined();
  });
});

describe('roundCents', () => {
  it('rounds to two decimal places', () => {
    expect(roundCents(1.125)).toBe(1.13);
    expect(roundCents(1.124)).toBe(1.12);
    expect(roundCents(0.1 + 0.2)).toBe(0.3);
  });
});
