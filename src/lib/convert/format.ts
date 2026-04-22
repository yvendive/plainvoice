import type { Locale } from './types';

const moneyCache = new Map<string, Intl.NumberFormat>();
const numberCache = new Map<string, Intl.NumberFormat>();

function moneyFormatter(locale: Locale, currency: string): Intl.NumberFormat {
  const key = `${locale}:${currency}`;
  const cached = moneyCache.get(key);
  if (cached) return cached;
  const intlLocale = locale === 'de' ? 'de-DE' : 'en-GB';
  const fmt = new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  moneyCache.set(key, fmt);
  return fmt;
}

function plainNumberFormatter(locale: Locale, maxDecimals: number): Intl.NumberFormat {
  const key = `${locale}:${maxDecimals}`;
  const cached = numberCache.get(key);
  if (cached) return cached;
  const intlLocale = locale === 'de' ? 'de-DE' : 'en-GB';
  const fmt = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
    useGrouping: true,
  });
  numberCache.set(key, fmt);
  return fmt;
}

export function formatMoney(value: number, currency: string, locale: Locale): string {
  return moneyFormatter(locale, currency).format(value);
}

export function formatQuantity(value: number, locale: Locale): string {
  return plainNumberFormatter(locale, 3).format(value);
}

export function formatPercent(value: number, locale: Locale): string {
  return plainNumberFormatter(locale, 2).format(value);
}

export function formatDate(iso: string | undefined, locale: Locale): string {
  if (!iso) return '';
  const trimmed = iso.length > 10 ? iso.slice(0, 10) : iso;
  const parts = trimmed.split('-');
  if (parts.length !== 3) return trimmed;
  const [y, m, d] = parts;
  return locale === 'de' ? `${d}.${m}.${y}` : `${y}-${m}-${d}`;
}

export function formatCsvAmount(value: number, decimal: ',' | '.'): string {
  const fixed = value.toFixed(2);
  return decimal === ',' ? fixed.replace('.', ',') : fixed;
}

export function formatCsvQuantity(value: number, decimal: ',' | '.'): string {
  const fixed = value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  if (!fixed.includes('.')) return fixed;
  return decimal === ',' ? fixed.replace('.', ',') : fixed;
}

export function formatCsvRate(value: number, decimal: ',' | '.'): string {
  const fixed = value.toFixed(2);
  return decimal === ',' ? fixed.replace('.', ',') : fixed;
}
