import type { Invoice } from '@/lib/invoice';
import { invoiceFilename } from './filename';
import { formatCsvAmount, formatCsvQuantity, formatCsvRate } from './format';
import { labelsFor } from './labels';
import type { Converter, CsvCompatibility, CsvOptions, CsvSeparator } from './types';

const BOM = '\uFEFF';
const EOL = '\r\n';
const MIME = 'text/csv;charset=utf-8';
const LEGACY_NEWLINE_REPLACEMENT = ' · ';

function normalizeForLegacy(value: string): string {
  return value
    .replace(/\r\n|\r|\n/g, LEGACY_NEWLINE_REPLACEMENT)
    .replace(/(\s·\s){2,}/g, LEGACY_NEWLINE_REPLACEMENT);
}

function needsQuoting(cell: string, separator: CsvSeparator): boolean {
  if (cell.length === 0) return false;
  if (cell.includes(separator)) return true;
  if (cell.includes('"')) return true;
  if (cell.includes('\n') || cell.includes('\r')) return true;
  return false;
}

function quote(cell: string): string {
  return `"${cell.replace(/"/g, '""')}"`;
}

function encodeCell(
  value: string | number | null | undefined,
  separator: CsvSeparator,
  compatibility: CsvCompatibility,
): string {
  if (value === null || value === undefined) return '';
  const str =
    typeof value === 'string' && compatibility === 'legacy'
      ? normalizeForLegacy(String(value))
      : String(value);
  return needsQuoting(str, separator) ? quote(str) : str;
}

function writeRow(
  cells: Array<string | number | null | undefined>,
  separator: CsvSeparator,
  compatibility: CsvCompatibility,
): string {
  return cells.map((c) => encodeCell(c, separator, compatibility)).join(separator);
}

function lineItemsHeader(locale: 'de' | 'en'): string[] {
  const c = labelsFor(locale).columns;
  return [
    c.invoiceNumber,
    c.issueDate,
    c.dueDate,
    c.sellerName,
    c.sellerVatId,
    c.buyerName,
    c.buyerReference,
    c.lineId,
    c.itemName,
    c.itemDescription,
    c.quantity,
    c.unitCode,
    c.unitPrice,
    c.lineNetAmount,
    c.taxCategory,
    c.taxRate,
    c.currency,
    c.grandTotal,
    c.amountDue,
  ];
}

function headerOnlyHeader(locale: 'de' | 'en'): string[] {
  const c = labelsFor(locale).columns;
  return [
    c.invoiceNumber,
    c.issueDate,
    c.dueDate,
    c.sellerName,
    c.sellerVatId,
    c.buyerName,
    c.buyerReference,
    c.lineCount,
    c.lineNetTotal,
    c.taxTotal,
    c.currency,
    c.grandTotal,
    c.amountDue,
    c.iban,
    c.bic,
    c.paymentTermsNote,
  ];
}

function buildLineItems(invoice: Invoice, options: CsvOptions): string[][] {
  const { decimal } = options;
  return invoice.lines.map((line) => [
    invoice.number,
    invoice.issueDate,
    invoice.dueDate ?? '',
    invoice.seller.name,
    invoice.seller.vatId ?? '',
    invoice.buyer.name,
    invoice.buyerReference ?? '',
    line.id,
    line.name,
    line.description ?? '',
    formatCsvQuantity(line.quantity, decimal),
    line.unitCode,
    formatCsvAmount(line.unitPrice, decimal),
    formatCsvAmount(line.netAmount, decimal),
    line.taxCategory.code,
    formatCsvRate(line.taxCategory.rate, decimal),
    invoice.currency,
    formatCsvAmount(invoice.totals.taxInclusive, decimal),
    formatCsvAmount(invoice.totals.amountDue, decimal),
  ]);
}

function buildHeaderOnly(invoice: Invoice, options: CsvOptions): string[] {
  const { decimal } = options;
  const primaryPayment = invoice.paymentMeans[0];
  return [
    invoice.number,
    invoice.issueDate,
    invoice.dueDate ?? '',
    invoice.seller.name,
    invoice.seller.vatId ?? '',
    invoice.buyer.name,
    invoice.buyerReference ?? '',
    String(invoice.lines.length),
    formatCsvAmount(invoice.totals.lineNetTotal, decimal),
    formatCsvAmount(invoice.totals.taxTotal, decimal),
    invoice.currency,
    formatCsvAmount(invoice.totals.taxInclusive, decimal),
    formatCsvAmount(invoice.totals.amountDue, decimal),
    primaryPayment?.iban ?? '',
    primaryPayment?.bic ?? '',
    invoice.paymentTermsNote ?? '',
  ];
}

export const convertCsv: Converter<CsvOptions> = async (invoice, options) => {
  const { separator, layout, locale, compatibility } = options;
  const rows: string[] = [];

  if (layout === 'line-items') {
    rows.push(writeRow(lineItemsHeader(locale), separator, compatibility));
    for (const row of buildLineItems(invoice, options)) {
      rows.push(writeRow(row, separator, compatibility));
    }
  } else {
    rows.push(writeRow(headerOnlyHeader(locale), separator, compatibility));
    rows.push(writeRow(buildHeaderOnly(invoice, options), separator, compatibility));
  }

  const body = BOM + rows.join(EOL) + EOL;
  const blob = new Blob([body], { type: MIME });
  const baseName = invoiceFilename(invoice, 'csv', options.fallbackFilename);
  const filename =
    compatibility === 'legacy' ? baseName.replace(/\.csv$/, '-legacy.csv') : baseName;
  return {
    blob,
    filename,
    mimeType: MIME,
    byteSize: blob.size,
  };
};
