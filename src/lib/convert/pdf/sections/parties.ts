import type { Party } from '@/lib/invoice';
import { drawText, wrapText } from '../draw';
import type { PdfCtx } from '../context';
import {
  type Cursor,
  FONT_SIZE_BODY,
  FONT_SIZE_LABEL,
  FONT_SIZE_PARTY_NAME,
  LEADING_BODY,
  LEFT,
  USABLE_WIDTH,
} from '../layout';

const HALF_GUTTER = 8;
const HALF_WIDTH = (USABLE_WIDTH - HALF_GUTTER) / 2;

function buildAddressLines(party: Party, vatIdLabel: string): string[] {
  const lines: string[] = [];
  if (party.address.street) lines.push(party.address.street);
  if (party.address.additionalStreet) lines.push(party.address.additionalStreet);
  const city = [party.address.postalCode, party.address.city]
    .filter((s) => s && s.length > 0)
    .join(' ');
  const cityLine = [city, party.address.countryCode]
    .filter((s) => s && s.length > 0)
    .join(', ');
  if (cityLine) lines.push(cityLine);
  if (party.vatId) lines.push(`${vatIdLabel}: ${party.vatId}`);
  return lines;
}

export function drawParties(ctx: PdfCtx, cursor: Cursor): Cursor {
  const { invoice, labels, fonts, theme } = ctx;
  const { page } = cursor;
  const rightX = LEFT + HALF_WIDTH + HALF_GUTTER;

  function drawBlock(x: number, party: Party, heading: string): number {
    let y = cursor.y;
    drawText(page, {
      x,
      y,
      text: heading,
      font: fonts.bold,
      size: FONT_SIZE_LABEL,
      color: theme.muted,
    });
    y -= LEADING_BODY;

    const nameLines = wrapText(party.name, HALF_WIDTH, fonts.bold, FONT_SIZE_PARTY_NAME);
    for (const line of nameLines) {
      drawText(page, {
        x,
        y,
        text: line,
        font: fonts.bold,
        size: FONT_SIZE_PARTY_NAME,
        color: theme.body,
      });
      y -= LEADING_BODY;
    }

    for (const raw of buildAddressLines(party, labels.columns.sellerVatId)) {
      const wrapped = wrapText(raw, HALF_WIDTH, fonts.regular, FONT_SIZE_BODY);
      for (const w of wrapped) {
        drawText(page, {
          x,
          y,
          text: w,
          font: fonts.regular,
          size: FONT_SIZE_BODY,
          color: theme.body,
        });
        y -= LEADING_BODY;
      }
    }

    return y;
  }

  const buyerY = drawBlock(LEFT, invoice.buyer, labels.pdf.billTo);
  const payeeY = invoice.payee ? drawBlock(rightX, invoice.payee, labels.pdf.payee) : cursor.y;

  return { page, y: Math.min(buyerY, payeeY) - 12 };
}
