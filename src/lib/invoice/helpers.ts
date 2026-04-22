import type { ParseWarning } from './types';

/**
 * Coerces a fast-xml-parser field that may be either a single value or an
 * array of values into an array. Missing fields return an empty array.
 */
export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Extracts a text value from a fast-xml-parser node. The parser represents
 * text-plus-attribute nodes as objects with a `#text` key; elements with
 * only text collapse to a primitive.
 */
export function asText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('#text' in record) return asText(record['#text']);
  }
  return undefined;
}

/**
 * Parses an XML amount string into a number. Conformant X-Rechnung uses a
 * dot as decimal separator; we tolerate comma as a defensive fallback
 * (reported in the wild from older converters).
 */
export function toAmount(raw: unknown): number | undefined {
  const text = asText(raw);
  if (text === undefined) return undefined;
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  // Tolerate "1.234,56" (DE) and "1,234.56" (US) even though conformant
  // X-Rechnung always ships "1234.56".
  const normalised = trimmed.includes(',') && !trimmed.includes('.')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed.replace(/,/g, '');
  const n = Number(normalised);
  return Number.isFinite(n) ? n : undefined;
}

export function toAmountOr(raw: unknown, fallback: number): number {
  return toAmount(raw) ?? fallback;
}

/**
 * Normalises a CII `udt:DateTimeString` node into `YYYY-MM-DD`.
 *
 * CII conventionally ships `format="102"` for `CCYYMMDD`; we also accept
 * `format="610"` (`CCYYMM`, padded to day 01) with a warning. UBL pages
 * are already ISO-formatted — use {@link toIsoDate} for those.
 */
export function parseCiiDate(
  node: unknown,
  options: { field: string; warnings: ParseWarning[] },
): string | undefined {
  if (!node) return undefined;
  // fast-xml-parser flattens single-text children; for an element with attributes
  // we get the text under `#text` and attributes inlined (attributeNamePrefix '').
  const record = (
    typeof node === 'object' ? (node as Record<string, unknown>) : { '#text': node }
  ) as Record<string, unknown>;
  const format = asText(record.format);
  const raw = asText(record['#text']) ?? asText(node);
  if (!raw) return undefined;
  const compact = raw.replace(/\s+/g, '');
  if (!format || format === '102') {
    if (!/^\d{8}$/.test(compact)) return undefined;
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  }
  if (format === '610') {
    if (!/^\d{6}$/.test(compact)) return undefined;
    options.warnings.push({ kind: 'unsupported-date-format', format, raw });
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-01`;
  }
  options.warnings.push({ kind: 'unsupported-date-format', format, raw });
  return undefined;
}

/**
 * Normalises an ISO-ish UBL date (`cbc:IssueDate` etc.) to `YYYY-MM-DD`.
 * Already-ISO inputs pass straight through.
 */
export function toIsoDate(raw: unknown): string | undefined {
  const text = asText(raw);
  if (!text) return undefined;
  const trimmed = text.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // Tolerate `YYYY-MM-DDThh:mm:ss(+Z)` or `YYYY-MM-DD hh:mm:ss`
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return undefined;
}

export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
