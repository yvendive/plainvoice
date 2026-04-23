import type { PDFPage } from 'pdf-lib';
import { formatMoney, formatPercentage, formatQuantity } from '../../format';
import { drawHorizontalRule, drawRightAlignedText, drawText, wrapText } from '../draw';
import type { PdfCtx } from '../context';
import { mapUnitCode } from '../context';
import {
  type Cursor,
  COL_LEFT,
  COL_RIGHT,
  COL_WIDTH,
  FONT_SIZE_BODY,
  FONT_SIZE_LABEL,
  FOOTER_RESERVE,
  LEADING_BODY,
  LEFT,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  MARGIN,
  USABLE_WIDTH,
} from '../layout';

const CELL_INSET = 2;
const DESC_MAX_WIDTH = COL_WIDTH.description - CELL_INSET;

function drawColumnHeader(ctx: PdfCtx, page: PDFPage, y: number): void {
  const { labels, fonts, theme } = ctx;
  const C = labels.columns;

  drawText(page, {
    x: COL_LEFT.idx,
    y,
    text: '#',
    font: fonts.bold,
    size: FONT_SIZE_LABEL,
    color: theme.muted,
  });
  drawText(page, {
    x: COL_LEFT.description,
    y,
    text: C.itemDescription,
    font: fonts.bold,
    size: FONT_SIZE_LABEL,
    color: theme.muted,
  });
  drawRightAlignedText(page, {
    x: COL_RIGHT.qty - CELL_INSET,
    y,
    text: C.quantity,
    font: fonts.bold,
    size: FONT_SIZE_LABEL,
    color: theme.muted,
  });
  drawText(page, {
    x: COL_LEFT.unit + CELL_INSET,
    y,
    text: C.unitCode,
    font: fonts.bold,
    size: FONT_SIZE_LABEL,
    color: theme.muted,
  });
  drawRightAlignedText(page, {
    x: COL_RIGHT.unitPrice - CELL_INSET,
    y,
    text: C.unitPrice,
    font: fonts.bold,
    size: FONT_SIZE_LABEL,
    color: theme.muted,
  });
  drawRightAlignedText(page, {
    x: COL_RIGHT.taxPct - CELL_INSET,
    y,
    text: C.taxRate,
    font: fonts.bold,
    size: FONT_SIZE_LABEL,
    color: theme.muted,
  });
  drawRightAlignedText(page, {
    x: COL_RIGHT.net,
    y,
    text: C.lineNetAmount,
    font: fonts.bold,
    size: FONT_SIZE_LABEL,
    color: theme.muted,
  });

  drawHorizontalRule(page, {
    x: LEFT,
    y: y - 3,
    width: USABLE_WIDTH,
    thickness: 0.5,
    color: theme.muted,
  });
}

function drawPage2Header(ctx: PdfCtx, page: PDFPage): number {
  const { invoice, labels, fonts, theme, locale, doc } = ctx;
  const title = invoice.typeCode === '381' ? labels.docTitleCreditNote : labels.docTitleInvoice;
  const topY = PAGE_HEIGHT - MARGIN - FONT_SIZE_LABEL;
  drawText(page, {
    x: LEFT,
    y: topY,
    text: title,
    font: fonts.bold,
    size: FONT_SIZE_LABEL,
    color: theme.body,
  });
  const pageIndex = doc.getPages().indexOf(page) + 1;
  const pageMark = locale === 'de' ? `Seite ${pageIndex}` : `Page ${pageIndex}`;
  drawRightAlignedText(page, {
    x: PAGE_WIDTH - MARGIN,
    y: topY,
    text: pageMark,
    font: fonts.regular,
    size: FONT_SIZE_LABEL,
    color: theme.muted,
  });
  let y = topY - LEADING_BODY;
  drawText(page, {
    x: LEFT,
    y,
    text: invoice.number,
    font: fonts.regular,
    size: FONT_SIZE_BODY,
    color: theme.muted,
  });
  y -= LEADING_BODY;
  return y;
}

function addContinuationPage(ctx: PdfCtx): { page: PDFPage; y: number } {
  const page = ctx.doc.addPage(ctx.pageSize);
  const afterHeader = drawPage2Header(ctx, page);
  const tableHeaderY = afterHeader - 4;
  drawColumnHeader(ctx, page, tableHeaderY);
  return { page, y: tableHeaderY - LEADING_BODY };
}

export function drawLines(ctx: PdfCtx, cursor: Cursor): Cursor {
  const { invoice, labels, fonts, theme, locale } = ctx;
  let page = cursor.page;
  let y = cursor.y;

  drawColumnHeader(ctx, page, y);
  y -= LEADING_BODY;

  for (let i = 0; i < invoice.lines.length; i++) {
    const line = invoice.lines[i];
    const descriptionSource = line.description ?? line.name;
    const descLines = wrapText(descriptionSource, DESC_MAX_WIDTH, fonts.regular, FONT_SIZE_BODY);
    const rowHeight = Math.max(descLines.length, 1) * LEADING_BODY + 2;

    if (y - rowHeight < FOOTER_RESERVE) {
      const next = addContinuationPage(ctx);
      page = next.page;
      y = next.y;
    }

    const topOfRow = y;

    drawText(page, {
      x: COL_LEFT.idx,
      y: topOfRow,
      text: String(i + 1),
      font: fonts.regular,
      size: FONT_SIZE_BODY,
      color: theme.body,
    });

    let descY = topOfRow;
    for (const dl of descLines) {
      drawText(page, {
        x: COL_LEFT.description,
        y: descY,
        text: dl,
        font: fonts.regular,
        size: FONT_SIZE_BODY,
        color: theme.body,
      });
      descY -= LEADING_BODY;
    }

    drawRightAlignedText(page, {
      x: COL_RIGHT.qty - CELL_INSET,
      y: topOfRow,
      text: formatQuantity(line.quantity, locale),
      font: fonts.regular,
      size: FONT_SIZE_BODY,
      color: theme.body,
    });

    drawText(page, {
      x: COL_LEFT.unit + CELL_INSET,
      y: topOfRow,
      text: mapUnitCode(line.unitCode, labels),
      font: fonts.regular,
      size: FONT_SIZE_BODY,
      color: theme.body,
    });

    drawRightAlignedText(page, {
      x: COL_RIGHT.unitPrice - CELL_INSET,
      y: topOfRow,
      text: formatMoney(line.unitPrice, invoice.currency, locale),
      font: fonts.regular,
      size: FONT_SIZE_BODY,
      color: theme.body,
    });

    const taxText =
      line.taxCategory.code === 'AE'
        ? labels.pdf.emDash
        : formatPercentage(line.taxCategory.rate, locale);
    drawRightAlignedText(page, {
      x: COL_RIGHT.taxPct - CELL_INSET,
      y: topOfRow,
      text: taxText,
      font: fonts.regular,
      size: FONT_SIZE_BODY,
      color: theme.body,
    });

    drawRightAlignedText(page, {
      x: COL_RIGHT.net,
      y: topOfRow,
      text: formatMoney(line.netAmount, invoice.currency, locale),
      font: fonts.regular,
      size: FONT_SIZE_BODY,
      color: theme.body,
    });

    y = topOfRow - rowHeight;
  }

  return { page, y: y - 4 };
}
