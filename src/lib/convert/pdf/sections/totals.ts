import { formatMoney, formatPercentage } from '../../format';
import { drawHorizontalRule, drawRightAlignedText, drawText } from '../draw';
import type { PdfCtx } from '../context';
import {
  type Cursor,
  FONT_SIZE_BODY,
  FONT_SIZE_PARTY_NAME,
  FONT_SIZE_TOTALS,
  LEADING_BODY,
  RIGHT,
} from '../layout';

const BLOCK_WIDTH = 180;

export function drawTotals(ctx: PdfCtx, cursor: Cursor): Cursor {
  const { invoice, labels, fonts, theme, locale } = ctx;
  const { page } = cursor;
  const labelX = RIGHT - BLOCK_WIDTH;
  const valueX = RIGHT;
  const currency = invoice.currency;
  let y = cursor.y;

  for (const row of invoice.taxBreakdown) {
    const rate = formatPercentage(row.category.rate, locale);
    drawText(page, {
      x: labelX,
      y,
      text: `${labels.fields.net} ${rate}`,
      font: fonts.regular,
      size: FONT_SIZE_BODY,
      color: theme.muted,
    });
    drawRightAlignedText(page, {
      x: valueX,
      y,
      text: formatMoney(row.taxableAmount, currency, locale),
      font: fonts.regular,
      size: FONT_SIZE_BODY,
      color: theme.body,
    });
    y -= LEADING_BODY;

    drawText(page, {
      x: labelX,
      y,
      text: `${labels.pdf.vatLabel} ${rate}`,
      font: fonts.regular,
      size: FONT_SIZE_BODY,
      color: theme.muted,
    });
    drawRightAlignedText(page, {
      x: valueX,
      y,
      text: formatMoney(row.taxAmount, currency, locale),
      font: fonts.regular,
      size: FONT_SIZE_BODY,
      color: theme.body,
    });
    y -= LEADING_BODY;
  }

  y -= 4;

  drawText(page, {
    x: labelX,
    y,
    text: labels.pdf.netSubtotal,
    font: fonts.regular,
    size: FONT_SIZE_BODY,
    color: theme.body,
  });
  drawRightAlignedText(page, {
    x: valueX,
    y,
    text: formatMoney(invoice.totals.taxExclusive, currency, locale),
    font: fonts.regular,
    size: FONT_SIZE_BODY,
    color: theme.body,
  });
  y -= LEADING_BODY;

  drawText(page, {
    x: labelX,
    y,
    text: labels.pdf.vatLabel,
    font: fonts.regular,
    size: FONT_SIZE_BODY,
    color: theme.body,
  });
  drawRightAlignedText(page, {
    x: valueX,
    y,
    text: formatMoney(invoice.totals.taxTotal, currency, locale),
    font: fonts.regular,
    size: FONT_SIZE_BODY,
    color: theme.body,
  });
  y -= LEADING_BODY;

  y -= 2;
  drawHorizontalRule(page, {
    x: labelX,
    y,
    width: valueX - labelX,
    thickness: 0.5,
    color: theme.accent,
  });
  y -= 8;

  drawText(page, {
    x: labelX,
    y,
    text: labels.pdf.totalInclVat,
    font: fonts.bold,
    size: FONT_SIZE_PARTY_NAME,
    color: theme.body,
  });
  drawRightAlignedText(page, {
    x: valueX,
    y,
    text: formatMoney(invoice.totals.taxInclusive, currency, locale),
    font: fonts.bold,
    size: FONT_SIZE_PARTY_NAME,
    color: theme.body,
  });
  y -= LEADING_BODY + 2;

  if (invoice.totals.paidAmount !== 0) {
    drawText(page, {
      x: labelX,
      y,
      text: labels.pdf.paid,
      font: fonts.regular,
      size: FONT_SIZE_BODY,
      color: theme.body,
    });
    drawRightAlignedText(page, {
      x: valueX,
      y,
      text: formatMoney(-invoice.totals.paidAmount, currency, locale),
      font: fonts.regular,
      size: FONT_SIZE_BODY,
      color: theme.body,
    });
    y -= LEADING_BODY;
  }

  if (invoice.totals.roundingAmount !== 0) {
    drawText(page, {
      x: labelX,
      y,
      text: labels.pdf.rounding,
      font: fonts.regular,
      size: FONT_SIZE_BODY,
      color: theme.body,
    });
    drawRightAlignedText(page, {
      x: valueX,
      y,
      text: formatMoney(invoice.totals.roundingAmount, currency, locale),
      font: fonts.regular,
      size: FONT_SIZE_BODY,
      color: theme.body,
    });
    y -= LEADING_BODY;
  }

  drawText(page, {
    x: labelX,
    y,
    text: labels.pdf.amountDue,
    font: fonts.bold,
    size: FONT_SIZE_TOTALS,
    color: theme.accent,
  });
  drawRightAlignedText(page, {
    x: valueX,
    y,
    text: formatMoney(invoice.totals.amountDue, currency, locale),
    font: fonts.bold,
    size: FONT_SIZE_TOTALS,
    color: theme.accent,
  });
  y -= FONT_SIZE_TOTALS + 6;

  return { page, y };
}
