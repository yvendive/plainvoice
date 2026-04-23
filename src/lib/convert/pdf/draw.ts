// pdf-lib's y-axis runs bottom-up: y = 0 is the bottom of the page and increases upward.
// page.drawText(text, { x, y }) places the text baseline at y; glyphs extend upward.
// Remember this when laying out sections top-down — subtract leading from y before drawing
// the next line.

import type { PDFFont, PDFPage, RGB } from 'pdf-lib';

export interface DrawTextOptions {
  x: number;
  y: number;
  text: string;
  font: PDFFont;
  size: number;
  color?: RGB;
}

export function drawText(page: PDFPage, opts: DrawTextOptions): void {
  page.drawText(opts.text, {
    x: opts.x,
    y: opts.y,
    size: opts.size,
    font: opts.font,
    color: opts.color,
  });
}

// Right edge of the text lands at `x`.
export function drawRightAlignedText(page: PDFPage, opts: DrawTextOptions): void {
  const width = opts.font.widthOfTextAtSize(opts.text, opts.size);
  page.drawText(opts.text, {
    x: opts.x - width,
    y: opts.y,
    size: opts.size,
    font: opts.font,
    color: opts.color,
  });
}

export function drawHorizontalRule(
  page: PDFPage,
  opts: {
    x: number;
    y: number;
    width: number;
    thickness?: number;
    color: RGB;
  },
): void {
  page.drawLine({
    start: { x: opts.x, y: opts.y },
    end: { x: opts.x + opts.width, y: opts.y },
    thickness: opts.thickness ?? 0.5,
    color: opts.color,
  });
}

export function wrapText(
  text: string,
  maxWidth: number,
  font: PDFFont,
  size: number,
): string[] {
  const paragraphs = text.split(/\r\n|\r|\n/);
  const output: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      output.push('');
      continue;
    }
    const words = paragraph.split(' ');
    let line = '';
    for (const word of words) {
      const candidate = line.length === 0 ? word : line + ' ' + word;
      const width = font.widthOfTextAtSize(candidate, size);
      if (width <= maxWidth || line.length === 0) {
        line = candidate;
      } else {
        output.push(line);
        line = word;
      }
    }
    output.push(line);
  }
  return output;
}
