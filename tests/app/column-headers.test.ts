// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { labelsFor } from '@/lib/convert/labels';
import { COL_WIDTH, FONT_SIZE_LABEL } from '@/lib/convert/pdf/layout';

describe('PDF column header widths', () => {
  it('all headers fit within their column widths (4pt inset) in DE', async () => {
    const doc = await PDFDocument.create();
    const { StandardFonts } = await import('pdf-lib');
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const labels = labelsFor('de');
    const C = labels.columns;
    const PC = labels.pdf.columns;

    const checks: [string, number, string][] = [
      ['#', COL_WIDTH.idx, 'idx'],
      [C.itemDescription, COL_WIDTH.description, 'description'],
      [C.quantity, COL_WIDTH.qty, 'qty'],
      [C.unitCode, COL_WIDTH.unit, 'unit'],
      [PC.unitPrice, COL_WIDTH.unitPrice, 'unitPrice'],
      [PC.taxPct, COL_WIDTH.taxPct, 'taxPct'],
      [C.lineNetAmount, COL_WIDTH.net, 'net'],
    ];

    for (const [label, width, name] of checks) {
      const measured = font.widthOfTextAtSize(label, FONT_SIZE_LABEL);
      expect(measured, `DE "${label}" in column "${name}"`).toBeLessThanOrEqual(width - 4);
    }
  });

  it('all headers fit within their column widths (4pt inset) in EN', async () => {
    const doc = await PDFDocument.create();
    const { StandardFonts } = await import('pdf-lib');
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const labels = labelsFor('en');
    const C = labels.columns;
    const PC = labels.pdf.columns;

    const checks: [string, number, string][] = [
      ['#', COL_WIDTH.idx, 'idx'],
      [C.itemDescription, COL_WIDTH.description, 'description'],
      [C.quantity, COL_WIDTH.qty, 'qty'],
      [C.unitCode, COL_WIDTH.unit, 'unit'],
      [PC.unitPrice, COL_WIDTH.unitPrice, 'unitPrice'],
      [PC.taxPct, COL_WIDTH.taxPct, 'taxPct'],
      [C.lineNetAmount, COL_WIDTH.net, 'net'],
    ];

    for (const [label, width, name] of checks) {
      const measured = font.widthOfTextAtSize(label, FONT_SIZE_LABEL);
      expect(measured, `EN "${label}" in column "${name}"`).toBeLessThanOrEqual(width - 4);
    }
  });
});
