import { drawText, wrapText } from '../draw';
import type { PdfCtx } from '../context';
import {
  type Cursor,
  FONT_SIZE_BODY,
  FONT_SIZE_LABEL,
  FOOTER_Y,
  LEADING_BODY,
  LEFT,
  USABLE_WIDTH,
} from '../layout';

export function formatIban(iban: string): string {
  const clean = iban.replace(/\s+/g, '').toUpperCase();
  if (clean.length === 0) return clean;
  return clean.match(/.{1,4}/g)?.join(' ') ?? clean;
}

export function drawPayment(ctx: PdfCtx, cursor: Cursor): Cursor {
  const { invoice, labels, fonts, theme } = ctx;
  const ibanMeans = invoice.paymentMeans.filter((m) => m.iban && m.iban.length > 0);
  const termsNote = (invoice.paymentTermsNote ?? '').trim();
  if (ibanMeans.length === 0 && termsNote.length === 0) return cursor;

  const { page } = cursor;
  let y = cursor.y;

  drawText(page, {
    x: LEFT,
    y,
    text: labels.pdf.paymentInfo,
    font: fonts.bold,
    size: FONT_SIZE_LABEL,
    color: theme.body,
  });
  y -= LEADING_BODY;

  for (const m of ibanMeans) {
    const parts: string[] = [];
    parts.push(`${labels.fields.iban}: ${formatIban(m.iban!)}`);
    if (m.bic) parts.push(`${labels.fields.bic}: ${m.bic}`);
    if (m.accountHolder) {
      parts.push(`${labels.pdf.accountHolder}: ${m.accountHolder}`);
    }
    const combined = parts.join('   ');
    const wrapped = wrapText(combined, USABLE_WIDTH, fonts.regular, FONT_SIZE_BODY);
    for (const line of wrapped) {
      drawText(page, {
        x: LEFT,
        y,
        text: line,
        font: fonts.regular,
        size: FONT_SIZE_BODY,
        color: theme.body,
      });
      y -= LEADING_BODY;
    }
  }

  if (termsNote.length > 0) {
    const wrapped = wrapText(termsNote, USABLE_WIDTH, fonts.regular, FONT_SIZE_BODY);
    const available = y - (FOOTER_Y + 40);
    const maxLines = Math.max(1, Math.floor(available / LEADING_BODY));
    let linesToDraw = wrapped;
    if (wrapped.length > maxLines) {
      linesToDraw = wrapped.slice(0, Math.max(1, maxLines - 1));
      linesToDraw.push('…');
      if (typeof console !== 'undefined' && process.env.NODE_ENV !== 'production') {
        console.warn('[convertPdf] payment terms note truncated due to page space');
      }
    }
    for (const line of linesToDraw) {
      drawText(page, {
        x: LEFT,
        y,
        text: line,
        font: fonts.regular,
        size: FONT_SIZE_BODY,
        color: theme.body,
      });
      y -= LEADING_BODY;
    }
  }

  return { page, y };
}
