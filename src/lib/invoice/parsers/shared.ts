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
 * - `processEntities: false` is a security hardening (#17). X-Rechnung
 *   never uses entity references; turning the expansion off forecloses an
 *   entire family of XML attacks (billion-laughs, recursive expansion,
 *   external entity sniffing) at the parser layer. Entity *declarations*
 *   are rejected separately via `rejectsEntityDeclarations()` BEFORE the
 *   parse call, so callers cannot smuggle one through.
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
    processEntities: false,
  });
}

export type ParsedXml = Record<string, unknown>;

/**
 * Pre-flight scan for prohibited XML declarations.
 *
 * Even with `processEntities: false`, accepting a document that *declares*
 * entities is a code smell — it indicates an XML payload outside the
 * X-Rechnung profile. We reject early so the converter UI can surface a
 * specific security message instead of letting the document slip into
 * dialect detection where it would just be reported as "unknown syntax".
 *
 * Only the prologue is scanned: entity declarations are illegal after the
 * root element starts, and scanning the full body wastes cycles on
 * legitimate large invoices.
 */
const PROHIBITED_XML_DECLARATIONS = /<!(DOCTYPE|ENTITY)\b/i;

export function rejectsEntityDeclarations(xml: string): boolean {
  const prologue = xml.slice(0, 4096);
  return PROHIBITED_XML_DECLARATIONS.test(prologue);
}

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
  // Defense in depth: even if a caller bypasses parseInvoice's pre-flight,
  // any entity-declaration-bearing payload is refused at the parser layer.
  // Production code should still go through parseInvoice so the UI can show
  // the specific xml-entity-declarations-forbidden error kind.
  if (rejectsEntityDeclarations(raw)) {
    return { ok: false, detail: 'XML entity declarations are not permitted.' };
  }
  const valid = validateXml(raw);
  if (!valid.ok) return valid;
  const doc = makeXmlParser().parse(raw) as ParsedXml;
  return { ok: true, doc };
}
