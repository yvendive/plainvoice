import type { ParsedXml } from './shared';

export type DetectionResult =
  | { syntax: 'UBL'; rootElement: 'Invoice' | 'CreditNote' }
  | { syntax: 'CII'; rootElement: 'CrossIndustryInvoice' }
  | { syntax: 'unknown'; rootElement: string };

/**
 * Decides whether the parsed document is UBL or CII.
 *
 * We can't inspect xmlns attributes because `removeNSPrefix: true` drops
 * them during parse, so we fingerprint by the root element plus the
 * presence of at least one signature child element. This also shields
 * against stray `<Invoice>` or `<CrossIndustryInvoice>` roots in unrelated
 * XML documents (they won't have the signature children).
 */
export function detectSyntax(doc: ParsedXml): DetectionResult {
  const rootName = findRootElement(doc);
  if (!rootName) return { syntax: 'unknown', rootElement: '(none)' };
  const root = doc[rootName];
  if (!root || typeof root !== 'object') return { syntax: 'unknown', rootElement: rootName };
  const record = root as Record<string, unknown>;

  if (rootName === 'CrossIndustryInvoice' && hasAnyKey(record, CII_MARKERS)) {
    return { syntax: 'CII', rootElement: 'CrossIndustryInvoice' };
  }
  if (
    (rootName === 'Invoice' || rootName === 'CreditNote') &&
    hasAnyKey(record, UBL_MARKERS)
  ) {
    return { syntax: 'UBL', rootElement: rootName };
  }
  return { syntax: 'unknown', rootElement: rootName };
}

const CII_MARKERS = [
  'ExchangedDocumentContext',
  'ExchangedDocument',
  'SupplyChainTradeTransaction',
];

const UBL_MARKERS = [
  'AccountingSupplierParty',
  'AccountingCustomerParty',
  'LegalMonetaryTotal',
];

function hasAnyKey(record: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((k) => k in record);
}

function findRootElement(doc: ParsedXml): string | undefined {
  const keys = Object.keys(doc).filter((k) => !k.startsWith('@') && k !== '#text');
  return keys[0];
}
