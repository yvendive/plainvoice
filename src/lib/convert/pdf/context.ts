import type { PDFDocument, PDFFont } from 'pdf-lib';
import type { Invoice } from '@/lib/invoice';
import type { LabelBundle } from '../labels';
import type { Locale } from '../types';
import type { Theme } from './layout';

export interface PdfFonts {
  regular: PDFFont;
  bold: PDFFont;
}

export interface PdfCtx {
  invoice: Invoice;
  locale: Locale;
  labels: LabelBundle;
  fonts: PdfFonts;
  theme: Theme;
  doc: PDFDocument;
  pageSize: [number, number];
}

export function mapUnitCode(unitCode: string, labels: LabelBundle): string {
  switch (unitCode) {
    case 'HUR':
      return labels.pdf.units.hour;
    case 'XPP':
      return labels.pdf.units.piece;
    case 'C62':
      return labels.pdf.units.unit;
    default:
      return unitCode;
  }
}

export function hasReverseCharge(invoice: Invoice): boolean {
  if (invoice.taxBreakdown.some((r) => r.category.code === 'AE')) return true;
  if (invoice.lines.some((l) => l.taxCategory.code === 'AE')) return true;
  return false;
}
