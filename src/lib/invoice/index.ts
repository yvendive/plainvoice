import type { ParseResult } from './types';
import { parseXml, rejectsEntityDeclarations } from './parsers/shared';
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
export { MAX_XML_FILE_BYTES } from './limits';

/**
 * Top-level entry point. Sniffs the XML dialect and dispatches to the
 * matching dialect parser. Returns a typed `ParseResult` — no throws.
 *
 * Security pre-flight (#17): XML containing <!DOCTYPE or <!ENTITY
 * declarations is rejected here, BEFORE any fast-xml-parser invocation.
 * This is defence-in-depth: `processEntities: false` is already set on
 * the parser, but rejecting at the entry point gives the UI a specific
 * security message instead of leaking through as "unknown syntax".
 */
export function parseInvoice(xml: string): ParseResult {
  if (rejectsEntityDeclarations(xml)) {
    return { ok: false, error: { kind: 'xml-entity-declarations-forbidden' } };
  }
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
