import { invoiceFilename } from './filename';
import { labelsFor } from './labels';
import type { Converter, PdfOptions } from './types';
import { embedInter } from './pdf/fonts';
import {
  type Cursor,
  MARGIN,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  makeTheme,
} from './pdf/layout';
import { hasReverseCharge, type PdfCtx } from './pdf/context';
import { drawHeader } from './pdf/sections/header';
import { drawParties } from './pdf/sections/parties';
import { drawLines } from './pdf/sections/lines';
import { drawAllowances } from './pdf/sections/allowances';
import { drawTotals } from './pdf/sections/totals';
import { drawPayment } from './pdf/sections/payment';
import { drawPageFooters, drawReverseChargeDisclaimer } from './pdf/sections/footer';

const MIME = 'application/pdf';

export const convertPdf: Converter<PdfOptions> = async (invoice, options) => {
  const pdfLib = await import('pdf-lib');

  const labels = labelsFor(options.locale);
  const doc = await pdfLib.PDFDocument.create();
  doc.setTitle(invoice.number);
  doc.setAuthor(invoice.seller.name);
  doc.setCreator('Plainvoice');
  doc.setProducer('Plainvoice · plainvoice.de');
  doc.setSubject(
    invoice.typeCode === '381' ? labels.docTitleCreditNote : labels.docTitleInvoice,
  );
  if (hasReverseCharge(invoice)) {
    doc.setKeywords(['reverse-charge']);
  }
  doc.setCreationDate(new Date());

  const fonts = await embedInter(doc);
  const theme = makeTheme(pdfLib.rgb);

  const ctx: PdfCtx = {
    invoice,
    locale: options.locale,
    labels,
    fonts,
    theme,
    doc,
    pageSize: [PAGE_WIDTH, PAGE_HEIGHT],
  };

  const firstPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursor: Cursor = { page: firstPage, y: PAGE_HEIGHT - MARGIN };

  cursor = drawHeader(ctx, cursor);
  cursor = drawParties(ctx, cursor);
  cursor = drawLines(ctx, cursor);
  cursor = drawAllowances(ctx, cursor);
  cursor = drawTotals(ctx, cursor);
  drawPayment(ctx, cursor);

  drawReverseChargeDisclaimer(ctx);
  drawPageFooters(ctx);

  const bytes = await doc.save();
  const blob = new Blob([bytes as BlobPart], { type: MIME });
  return {
    blob,
    filename: invoiceFilename(invoice, 'pdf', options.fallbackFilename),
    mimeType: MIME,
    byteSize: blob.size,
  };
};
