import type { ParseResult } from './types';
import { parseXml } from './parsers/shared';
import { detectSyntax } from './parsers/detect';
import { parseUBL } from './parsers/ubl';
import { parseCII } from './parsers/cii';

export type {
  Invoice,
  LineItem,
  Party,
  Address,
  Contact,
  TaxCategory,
  TaxBreakdownRow,
  AllowanceCharge,
  PaymentMeans,
  Totals,
  ElectronicAddress,
} from './schema';
export { InvoiceSchema } from './schema';
export type { ParseResult, ParseError, ParseWarning, SourceSyntax } from './types';
export { parseUBL, parseCII, detectSyntax };

/**
 * Top-level entry point. Sniffs the XML dialect and dispatches to the
 * matching dialect parser. Returns a typed `ParseResult` — no throws.
 */
export function parseInvoice(xml: string): ParseResult {
  const parsed = parseXml(xml);
  if (!parsed.ok) {
    return { ok: false, error: { kind: 'not-xml', detail: parsed.detail } };
  }
  const detection = detectSyntax(parsed.doc);
  if (detection.syntax === 'UBL') return parseUBL(xml);
  if (detection.syntax === 'CII') return parseCII(xml);
  return {
    ok: false,
    error: {
      kind: 'unknown-syntax',
      rootElement: detection.rootElement,
    },
  };
}
