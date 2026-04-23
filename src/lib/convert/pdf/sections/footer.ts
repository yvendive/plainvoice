import { drawRightAlignedText, drawText } from '../draw';
import type { PdfCtx } from '../context';
import { hasReverseCharge } from '../context';
import {
  FONT_SIZE_BODY,
  FONT_SIZE_FOOTER,
  FOOTER_Y,
  LEFT,
  RIGHT,
} from '../layout';

const DISCLAIMER_Y = 80;

export function drawReverseChargeDisclaimer(ctx: PdfCtx): void {
  const { invoice, labels, fonts, theme, doc } = ctx;
  if (!hasReverseCharge(invoice)) return;

  const pages = doc.getPages();
  if (pages.length === 0) return;
  const page = pages[pages.length - 1];

  drawText(page, {
    x: LEFT,
    y: DISCLAIMER_Y,
    text: labels.pdf.reverseChargeNote,
    font: fonts.regular,
    size: FONT_SIZE_BODY,
    color: theme.muted,
  });
}

export function drawPageFooters(ctx: PdfCtx): void {
  const { doc, labels, fonts, theme } = ctx;
  const pages = doc.getPages();
  const total = pages.length;
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    drawText(page, {
      x: LEFT,
      y: FOOTER_Y,
      text: labels.pdf.pageOf(i + 1, total),
      font: fonts.regular,
      size: FONT_SIZE_FOOTER,
      color: theme.muted,
    });
    drawRightAlignedText(page, {
      x: RIGHT,
      y: FOOTER_Y,
      text: labels.pdf.footerBrand,
      font: fonts.regular,
      size: FONT_SIZE_FOOTER,
      color: theme.muted,
    });
  }
}
