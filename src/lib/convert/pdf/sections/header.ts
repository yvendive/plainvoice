import { formatDate } from '../../format';
import { drawRightAlignedText, drawText, wrapText } from '../draw';
import type { PdfCtx } from '../context';
import {
  type Cursor,
  FONT_SIZE_BODY,
  FONT_SIZE_PARTY_NAME,
  FONT_SIZE_TITLE,
  LEADING_BODY,
  LEFT,
  MARGIN,
  PAGE_HEIGHT,
  RIGHT,
  USABLE_WIDTH,
} from '../layout';

const LEFT_MAX_WIDTH = (USABLE_WIDTH - 8) / 2;

export function drawHeader(ctx: PdfCtx, cursor: Cursor): Cursor {
  const { invoice, labels, fonts, theme, locale } = ctx;
  const { page } = cursor;
  const top = PAGE_HEIGHT - MARGIN;

  // --- right-hand stack: title + metadata ---
  const title =
    invoice.typeCode === '381' ? labels.docTitleCreditNote : labels.docTitleInvoice;
  const titleBaseline = top - FONT_SIZE_TITLE;
  drawRightAlignedText(page, {
    x: RIGHT,
    y: titleBaseline,
    text: title,
    font: fonts.bold,
    size: FONT_SIZE_TITLE,
    color: theme.body,
  });

  let metaY = titleBaseline - FONT_SIZE_TITLE;

  const metaRows: Array<{ label: string; value: string }> = [];
  metaRows.push({ label: labels.fields.invoiceNumber, value: invoice.number });
  metaRows.push({
    label: labels.fields.issueDate,
    value: formatDate(invoice.issueDate, locale),
  });
  if (invoice.dueDate) {
    metaRows.push({ label: labels.fields.dueDate, value: formatDate(invoice.dueDate, locale) });
  }
  if (invoice.buyerReference) {
    metaRows.push({ label: labels.fields.buyerReference, value: invoice.buyerReference });
  }

  for (const row of metaRows) {
    const text = `${row.label}: ${row.value}`;
    drawRightAlignedText(page, {
      x: RIGHT,
      y: metaY,
      text,
      font: fonts.regular,
      size: FONT_SIZE_BODY,
      color: theme.body,
    });
    metaY -= LEADING_BODY;
  }

  // --- left-hand stack: seller block ---
  let sellerY = top - FONT_SIZE_PARTY_NAME;
  const nameLines = wrapText(
    invoice.seller.name,
    LEFT_MAX_WIDTH,
    fonts.bold,
    FONT_SIZE_PARTY_NAME,
  );
  for (const line of nameLines) {
    drawText(page, {
      x: LEFT,
      y: sellerY,
      text: line,
      font: fonts.bold,
      size: FONT_SIZE_PARTY_NAME,
      color: theme.body,
    });
    sellerY -= LEADING_BODY;
  }

  const sellerLines: string[] = [];
  if (invoice.seller.address.street) sellerLines.push(invoice.seller.address.street);
  if (invoice.seller.address.additionalStreet) {
    sellerLines.push(invoice.seller.address.additionalStreet);
  }
  const cityParts = [invoice.seller.address.postalCode, invoice.seller.address.city]
    .filter((s) => s && s.length > 0)
    .join(' ');
  const cityLine = [cityParts, invoice.seller.address.countryCode]
    .filter((s) => s && s.length > 0)
    .join(', ');
  if (cityLine) sellerLines.push(cityLine);
  if (invoice.seller.vatId) {
    sellerLines.push(`${labels.columns.sellerVatId}: ${invoice.seller.vatId}`);
  }

  for (const line of sellerLines) {
    const wrapped = wrapText(line, LEFT_MAX_WIDTH, fonts.regular, FONT_SIZE_BODY);
    for (const w of wrapped) {
      drawText(page, {
        x: LEFT,
        y: sellerY,
        text: w,
        font: fonts.regular,
        size: FONT_SIZE_BODY,
        color: theme.body,
      });
      sellerY -= LEADING_BODY;
    }
  }

  return { page, y: Math.min(metaY, sellerY) - 8 };
}
