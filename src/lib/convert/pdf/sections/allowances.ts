import { formatMoney } from '../../format';
import { drawHorizontalRule, drawRightAlignedText, drawText } from '../draw';
import type { PdfCtx } from '../context';
import {
  type Cursor,
  FONT_SIZE_BODY,
  LEADING_BODY,
  LEFT,
  RIGHT,
  USABLE_WIDTH,
} from '../layout';

export function drawAllowances(ctx: PdfCtx, cursor: Cursor): Cursor {
  const { invoice, fonts, theme, locale } = ctx;
  if (invoice.allowancesCharges.length === 0) return cursor;

  const { page } = cursor;
  let y = cursor.y;

  for (const ac of invoice.allowancesCharges) {
    const signedAmount = ac.isCharge ? ac.amount : -ac.amount;
    const label = ac.reason && ac.reason.length > 0
      ? ac.reason
      : (ac.isCharge ? 'Charge' : 'Discount');

    drawText(page, {
      x: LEFT,
      y,
      text: label,
      font: fonts.regular,
      size: FONT_SIZE_BODY,
      color: theme.body,
    });
    drawRightAlignedText(page, {
      x: RIGHT,
      y,
      text: formatMoney(signedAmount, invoice.currency, locale),
      font: fonts.regular,
      size: FONT_SIZE_BODY,
      color: theme.body,
    });
    y -= LEADING_BODY;
  }

  y -= 2;
  drawHorizontalRule(page, {
    x: LEFT,
    y,
    width: USABLE_WIDTH,
    thickness: 0.5,
    color: theme.muted,
  });
  y -= 6;

  return { page, y };
}
