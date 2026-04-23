import type { PDFPage, RGB } from 'pdf-lib';

// A4 portrait in PDF points (1 pt = 1/72").
export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
export const MARGIN = 40;
export const USABLE_WIDTH = PAGE_WIDTH - 2 * MARGIN; // 515.28
export const USABLE_HEIGHT = PAGE_HEIGHT - 2 * MARGIN; // 761.89

export const LEFT = MARGIN;
export const RIGHT = PAGE_WIDTH - MARGIN; // 555.28
export const TOP = PAGE_HEIGHT - MARGIN; // 801.89
export const BOTTOM = MARGIN;

export const FOOTER_Y = 40;
export const FOOTER_RESERVE = 120;

export const FONT_SIZE_BODY = 9;
export const FONT_SIZE_LABEL = 9;
export const FONT_SIZE_PARTY_NAME = 10;
export const FONT_SIZE_TITLE = 18;
export const FONT_SIZE_TOTALS = 11;
export const FONT_SIZE_FOOTER = 8;
export const LEADING_BODY = 12;

export const COL_WIDTH = {
  idx: 22,
  description: 220,
  qty: 50,
  unit: 40,
  unitPrice: 70,
  taxPct: 40,
  net: 73.28,
} as const;

const idxLeft = LEFT;
const descLeft = idxLeft + COL_WIDTH.idx;
const qtyLeft = descLeft + COL_WIDTH.description;
const unitLeft = qtyLeft + COL_WIDTH.qty;
const unitPriceLeft = unitLeft + COL_WIDTH.unit;
const taxPctLeft = unitPriceLeft + COL_WIDTH.unitPrice;
const netLeft = taxPctLeft + COL_WIDTH.taxPct;

export const COL_LEFT = {
  idx: idxLeft,
  description: descLeft,
  qty: qtyLeft,
  unit: unitLeft,
  unitPrice: unitPriceLeft,
  taxPct: taxPctLeft,
  net: netLeft,
} as const;

export const COL_RIGHT = {
  idx: idxLeft + COL_WIDTH.idx,
  description: descLeft + COL_WIDTH.description,
  qty: qtyLeft + COL_WIDTH.qty,
  unit: unitLeft + COL_WIDTH.unit,
  unitPrice: unitPriceLeft + COL_WIDTH.unitPrice,
  taxPct: taxPctLeft + COL_WIDTH.taxPct,
  net: netLeft + COL_WIDTH.net,
} as const;

export const COLOR = {
  body: [0.10, 0.10, 0.12] as const,
  muted: [0.45, 0.45, 0.48] as const,
  accent: [0.20, 0.25, 0.55] as const,
};

export interface Theme {
  body: RGB;
  muted: RGB;
  accent: RGB;
}

export function makeTheme(rgb: (r: number, g: number, b: number) => RGB): Theme {
  return {
    body: rgb(...COLOR.body),
    muted: rgb(...COLOR.muted),
    accent: rgb(...COLOR.accent),
  };
}

export interface Cursor {
  page: PDFPage;
  y: number;
}
