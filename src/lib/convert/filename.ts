import type { Invoice } from '@/lib/invoice';

const MAX_BASE_LENGTH = 80;

function sanitise(raw: string): string {
  return raw
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.-]+/, '')
    .replace(/[_.-]+$/, '');
}

export function invoiceFilename(
  invoice: Invoice,
  ext: 'csv' | 'txt' | 'xlsx' | 'pdf',
  fallback = 'invoice',
): string {
  const cleaned = sanitise(invoice.number ?? '');
  const base = cleaned.length > 0 ? cleaned : sanitise(fallback) || 'invoice';
  const truncated = base.slice(0, MAX_BASE_LENGTH);
  return `${truncated}.${ext}`;
}
