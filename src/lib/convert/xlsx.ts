import type { Invoice } from '@/lib/invoice';
import { invoiceFilename } from './filename';
import { labelsFor } from './labels';
import type { Converter, Locale, XlsxOptions } from './types';

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type Worksheet = import('exceljs').Worksheet;
type Workbook = import('exceljs').Workbook;

function moneyFormat(locale: Locale, currency: string): string {
  const symbol = currency === 'EUR' ? '€' : currency;
  if (locale === 'de') return `#,##0.00 "${symbol}"`;
  return `"${symbol}" #,##0.00`;
}

function autoSizeColumns(sheet: Worksheet): void {
  sheet.columns.forEach((col) => {
    let maxLength = 0;
    if (col.eachCell) {
      col.eachCell({ includeEmpty: false }, (cell) => {
        const raw = cell.value;
        let text: string;
        if (raw === null || raw === undefined) text = '';
        else if (typeof raw === 'number') text = raw.toFixed(2);
        else if (typeof raw === 'string') text = raw;
        else if (typeof raw === 'object' && 'text' in raw) text = String(raw.text);
        else text = String(raw);
        const longestLine = text.split('\n').reduce((m, l) => Math.max(m, l.length), 0);
        if (longestLine > maxLength) maxLength = longestLine;
      });
    }
    const clamped = Math.min(50, Math.max(10, maxLength));
    col.width = clamped * 1.2;
  });
}

function buildOverview(sheet: Worksheet, invoice: Invoice, locale: Locale): void {
  const L = labelsFor(locale);
  const currency = invoice.currency;
  sheet.columns = [
    { header: L.sheets.field, key: 'field' },
    { header: L.sheets.value, key: 'value' },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).values = [L.sheets.field, L.sheets.value];

  const entries: Array<[string, string | number | undefined]> = [
    [L.fields.invoiceNumber, invoice.number],
    [L.fields.issueDate, invoice.issueDate],
    [L.fields.dueDate, invoice.dueDate],
    [L.fields.format, invoice.sourceSyntax],
    [L.fields.currency, invoice.currency],
    [L.fields.buyerReference, invoice.buyerReference],
    [L.sections.seller, invoice.seller.name],
    [L.columns.sellerVatId, invoice.seller.vatId],
    [L.sections.buyer, invoice.buyer.name],
    [L.fields.iban, invoice.paymentMeans[0]?.iban],
    [L.fields.bic, invoice.paymentMeans[0]?.bic],
    [L.fields.paymentTerms, invoice.paymentTermsNote],
    [L.fields.net, invoice.totals.taxExclusive],
    [L.fields.tax, invoice.totals.taxTotal],
    [L.fields.gross, invoice.totals.taxInclusive],
    [L.fields.amountDue, invoice.totals.amountDue],
  ];

  const moneyLabels = new Set([L.fields.net, L.fields.tax, L.fields.gross, L.fields.amountDue]);

  for (const [label, value] of entries) {
    if (value === undefined || value === null || value === '') continue;
    const row = sheet.addRow({ field: label, value });
    row.getCell('field').font = { bold: true };
    if (typeof value === 'number' && moneyLabels.has(label)) {
      row.getCell('value').numFmt = moneyFormat(locale, currency);
    }
  }

  autoSizeColumns(sheet);
}

function buildLines(sheet: Worksheet, invoice: Invoice, locale: Locale): void {
  const L = labelsFor(locale);
  const currency = invoice.currency;
  sheet.columns = [
    { header: L.columns.lineId, key: 'id' },
    { header: L.columns.itemName, key: 'name' },
    { header: L.columns.itemDescription, key: 'description' },
    { header: L.columns.quantity, key: 'quantity' },
    { header: L.columns.unitCode, key: 'unitCode' },
    { header: L.columns.unitPrice, key: 'unitPrice' },
    { header: L.columns.lineNetAmount, key: 'net' },
    { header: L.columns.taxCategory, key: 'taxCategory' },
    { header: L.columns.taxRate, key: 'taxRate' },
    { header: L.columns.currency, key: 'currency' },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const line of invoice.lines) {
    sheet.addRow({
      id: line.id,
      name: line.name,
      description: line.description ?? '',
      quantity: line.quantity,
      unitCode: line.unitCode,
      unitPrice: line.unitPrice,
      net: line.netAmount,
      taxCategory: line.taxCategory.code,
      taxRate: line.taxCategory.rate,
      currency: invoice.currency,
    });
  }

  const money = moneyFormat(locale, currency);
  sheet.getColumn('unitPrice').numFmt = money;
  sheet.getColumn('net').numFmt = money;
  sheet.getColumn('quantity').numFmt = '#,##0.###';
  sheet.getColumn('taxRate').numFmt = '#,##0.00';

  autoSizeColumns(sheet);
}

function buildTax(sheet: Worksheet, invoice: Invoice, locale: Locale): void {
  const L = labelsFor(locale);
  const currency = invoice.currency;
  sheet.columns = [
    { header: L.columns.taxCategory, key: 'category' },
    { header: L.columns.taxRate, key: 'rate' },
    { header: L.columns.taxBasis, key: 'basis' },
    { header: L.columns.taxAmount, key: 'amount' },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const row of invoice.taxBreakdown) {
    sheet.addRow({
      category: row.category.code,
      rate: row.category.rate,
      basis: row.taxableAmount,
      amount: row.taxAmount,
    });
  }

  const money = moneyFormat(locale, currency);
  sheet.getColumn('basis').numFmt = money;
  sheet.getColumn('amount').numFmt = money;
  sheet.getColumn('rate').numFmt = '#,##0.00';

  autoSizeColumns(sheet);
}

export const convertXlsx: Converter<XlsxOptions> = async (invoice, options) => {
  const ExcelJS = await import('exceljs');
  const L = labelsFor(options.locale);
  const workbook: Workbook = new ExcelJS.Workbook();
  workbook.creator = 'Plainvoice';
  workbook.created = new Date();

  buildOverview(workbook.addWorksheet(L.sheets.overview), invoice, options.locale);
  buildLines(workbook.addWorksheet(L.sheets.lines), invoice, options.locale);
  buildTax(workbook.addWorksheet(L.sheets.tax), invoice, options.locale);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], { type: MIME });
  return {
    blob,
    filename: invoiceFilename(invoice, 'xlsx', options.fallbackFilename),
    mimeType: MIME,
    byteSize: blob.size,
  };
};
