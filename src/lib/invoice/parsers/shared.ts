import { XMLParser, XMLValidator } from 'fast-xml-parser';

/**
 * Shared fast-xml-parser instance for UBL and CII dialects.
 *
 * - `removeNSPrefix` so `<cac:InvoiceLine>` and `<ram:ApplicableTradeTax>`
 *   collapse to local names (`InvoiceLine`, `ApplicableTradeTax`) — we
 *   disambiguate dialects by the root element and its xmlns attributes.
 * - `attributeNamePrefix: ''` so `<cbc:TaxAmount currencyID="EUR">38.00</cbc:TaxAmount>`
 *   lands as `{ currencyID: 'EUR', '#text': '38.00' }` without the default `@_` noise.
 * - `parseTagValue: false` keeps everything as strings so our `toAmount()`
 *   helper controls numeric coercion (including locale fallbacks).
 */
export function makeXmlParser() {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    // Namespace attributes on the root are the only reliable syntax signal
    // after NS-prefix stripping, so we keep `xmlns*`.
    ignoreDeclaration: true,
    processEntities: true,
  });
}

export type ParsedXml = Record<string, unknown>;

export function validateXml(raw: string): { ok: true } | { ok: false; detail: string } {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, detail: 'Input is empty.' };
  }
  const result = XMLValidator.validate(raw, { allowBooleanAttributes: true });
  if (result === true) return { ok: true };
  const msg = result.err?.msg ?? 'Unknown XML validation error';
  return { ok: false, detail: msg };
}

export function parseXml(raw: string): { ok: true; doc: ParsedXml } | { ok: false; detail: string } {
  const valid = validateXml(raw);
  if (!valid.ok) return valid;
  const doc = makeXmlParser().parse(raw) as ParsedXml;
  return { ok: true, doc };
}
