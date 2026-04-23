import type { Invoice, LineItem } from '@/lib/invoice';
import { invoiceFilename } from './filename';
import { formatMoney, formatQuantity } from './format';
import { labelsFor } from './labels';
import type { Converter, TxtOptions } from './types';

const EOL = '\r\n';
const MIME = 'text/plain;charset=utf-8';
const TOTAL_WIDTH = 64;
const LABEL_WIDTH = 20;
const INDENT = '  ';
const ELLIPSIS = '…';

function truncate(value: string, width: number): string {
  if (value.length <= width) return value;
  return value.slice(0, Math.max(0, width - 1)) + ELLIPSIS;
}

function padRight(value: string, width: number): string {
  const truncated = truncate(value, width);
  const missing = width - truncated.length;
  return missing > 0 ? truncated + ' '.repeat(missing) : truncated;
}

function padLeft(value: string, width: number): string {
  const truncated = truncate(value, width);
  const missing = width - truncated.length;
  return missing > 0 ? ' '.repeat(missing) + truncated : truncated;
}

function topBox(title: string): string[] {
  const inner = TOTAL_WIDTH - 2;
  const titlePadded = '  ' + padRight(title, inner - 2);
  return [
    '╔' + '═'.repeat(inner) + '╗',
    '║' + titlePadded + '║',
    '╚' + '═'.repeat(inner) + '╝',
  ];
}

function sectionHeader(title: string): string {
  const prefix = `── ${title} `;
  const remaining = Math.max(0, TOTAL_WIDTH - prefix.length);
  return prefix + '─'.repeat(remaining);
}

function sectionDivider(): string {
  return '─'.repeat(TOTAL_WIDTH);
}

function labelLine(label: string, value: string): string {
  return INDENT + padRight(label, LABEL_WIDTH) + ': ' + value;
}

function totalLine(label: string, value: string): string {
  const indentLen = INDENT.length;
  const valueLen = value.length;
  const remaining = TOTAL_WIDTH - indentLen - valueLen;
  const labelPadded = remaining > 0 ? padRight(label, remaining) : label;
  return INDENT + labelPadded + value;
}

function formatLineItem(
  line: LineItem,
  currency: string,
  locale: 'de' | 'en',
): string {
  const pos = padRight(line.id.slice(0, 4), 4);
  const name = padRight(line.name, 24);
  const qty = padLeft(`${formatQuantity(line.quantity, locale)} ${line.unitCode}`, 12);
  const unit = padLeft(formatMoney(line.unitPrice, currency, locale), 12);
  const net = padLeft(formatMoney(line.netAmount, currency, locale), 12);
  return INDENT + [pos, name, qty, unit, net].join('  ').trimEnd();
}

function renderHeader(invoice: Invoice, locale: 'de' | 'en'): string[] {
  const L = labelsFor(locale);
  const title = invoice.typeCode === '381' ? L.docTitleCreditNote : L.docTitleInvoice;
  const rows = [...topBox(title), ''];

  rows.push(labelLine(L.fields.invoiceNumber, invoice.number));
  rows.push(labelLine(L.fields.issueDate, invoice.issueDate));
  if (invoice.dueDate) rows.push(labelLine(L.fields.dueDate, invoice.dueDate));
  rows.push(labelLine(L.fields.format, invoice.sourceSyntax));
  rows.push(labelLine(L.fields.currency, invoice.currency));
  if (invoice.buyerReference) {
    rows.push(labelLine(L.fields.buyerReference, invoice.buyerReference));
  }
  rows.push('');
  return rows;
}

function renderParty(
  title: string,
  party: Invoice['seller'],
  vatLabel: string,
): string[] {
  const rows: string[] = [INDENT + title];
  rows.push(INDENT + INDENT + party.name);
  if (party.address.street) rows.push(INDENT + INDENT + party.address.street);
  const cityLine = [
    [party.address.postalCode, party.address.city].filter(Boolean).join(' '),
    party.address.countryCode,
  ]
    .filter((s) => s && s.length > 0)
    .join(', ');
  if (cityLine) rows.push(INDENT + INDENT + cityLine);
  if (party.vatId) rows.push(INDENT + INDENT + `${vatLabel}: ${party.vatId}`);
  rows.push('');
  return rows;
}

function renderLines(invoice: Invoice, locale: 'de' | 'en'): string[] {
  const L = labelsFor(locale);
  const C = L.columns;
  const rows: string[] = [];
  rows.push(INDENT + sectionHeader(L.sections.lineItems));
  const header =
    INDENT +
    [
      padRight(C.lineId, 4),
      padRight(C.itemName, 24),
      padLeft(C.quantity, 12),
      padLeft(C.unitPrice, 12),
      padLeft(C.lineNetAmount, 12),
    ].join('  ');
  rows.push(header);
  rows.push(INDENT + sectionDivider());
  for (const line of invoice.lines) {
    rows.push(formatLineItem(line, invoice.currency, locale));
  }
  rows.push(INDENT + sectionDivider());
  rows.push('');
  return rows;
}

function renderTaxBreakdown(invoice: Invoice, locale: 'de' | 'en'): string[] {
  if (invoice.taxBreakdown.length === 0) return [];
  const L = labelsFor(locale);
  const rows: string[] = [];
  rows.push(INDENT + sectionHeader(L.sections.taxBreakdown));
  for (const row of invoice.taxBreakdown) {
    const basis = formatMoney(row.taxableAmount, invoice.currency, locale);
    const tax = formatMoney(row.taxAmount, invoice.currency, locale);
    const rate = `${row.category.rate.toFixed(2).replace('.', locale === 'de' ? ',' : '.')} %`;
    const line =
      INDENT +
      [
        padRight(row.category.code, 3),
        padLeft(rate, 10),
        `${L.columns.taxBasis} ${padLeft(basis, 12)}`,
        `${L.columns.taxAmount} ${padLeft(tax, 12)}`,
      ].join('  ');
    rows.push(line);
    if (row.category.exemptionReason) {
      rows.push(INDENT + INDENT + `(${L.sections.exemptionReason}: ${row.category.exemptionReason})`);
    }
  }
  rows.push(INDENT + sectionDivider());
  rows.push('');
  return rows;
}

function renderTotals(invoice: Invoice, locale: 'de' | 'en'): string[] {
  const L = labelsFor(locale);
  const rows: string[] = [];
  rows.push(INDENT + sectionHeader(L.sections.totals));
  const currency = invoice.currency;
  rows.push(totalLine(L.fields.net, formatMoney(invoice.totals.taxExclusive, currency, locale)));
  rows.push(totalLine(L.fields.tax, formatMoney(invoice.totals.taxTotal, currency, locale)));
  rows.push(totalLine(L.fields.gross, formatMoney(invoice.totals.taxInclusive, currency, locale)));
  rows.push(totalLine(L.fields.amountDue, formatMoney(invoice.totals.amountDue, currency, locale)));
  rows.push('');
  return rows;
}

function renderPayment(invoice: Invoice, locale: 'de' | 'en'): string[] {
  const L = labelsFor(locale);
  const primary = invoice.paymentMeans[0];
  const hasTerms = (invoice.paymentTermsNote ?? '').trim().length > 0;
  if (!primary && !hasTerms) return [];
  const rows: string[] = [];
  rows.push(INDENT + `${L.fields.paymentTerms}:`);
  if (hasTerms) {
    rows.push(INDENT + INDENT + (invoice.paymentTermsNote ?? '').trim());
  }
  if (primary?.iban) rows.push(INDENT + INDENT + `${L.fields.iban}: ${primary.iban}`);
  if (primary?.bic) rows.push(INDENT + INDENT + `${L.fields.bic}: ${primary.bic}`);
  rows.push('');
  return rows;
}

function renderNotes(invoice: Invoice, locale: 'de' | 'en'): string[] {
  if (invoice.notes.length === 0) return [];
  const L = labelsFor(locale);
  const rows: string[] = [];
  rows.push(INDENT + `${L.sections.notes}:`);
  for (const note of invoice.notes) {
    rows.push(INDENT + INDENT + note);
  }
  rows.push('');
  return rows;
}

export const convertTxt: Converter<TxtOptions> = async (invoice, options) => {
  const { locale } = options;
  const L = labelsFor(locale);
  const rows: string[] = [];

  rows.push(...renderHeader(invoice, locale));
  rows.push(...renderParty(L.sections.seller, invoice.seller, L.columns.sellerVatId));
  rows.push(...renderParty(L.sections.buyer, invoice.buyer, L.columns.sellerVatId));
  rows.push(...renderLines(invoice, locale));
  rows.push(...renderTaxBreakdown(invoice, locale));
  rows.push(...renderTotals(invoice, locale));
  rows.push(...renderPayment(invoice, locale));
  rows.push(...renderNotes(invoice, locale));

  const body = rows.join(EOL) + EOL;
  const blob = new Blob([body], { type: MIME });
  return {
    blob,
    filename: invoiceFilename(invoice, 'txt', options.fallbackFilename),
    mimeType: MIME,
    byteSize: blob.size,
  };
};
