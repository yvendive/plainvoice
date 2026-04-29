/**
 * XML parser security hardening (#17).
 *
 * Covers:
 *  - DOCTYPE / ENTITY declaration pre-flight rejection (parseInvoice)
 *  - parser is configured with processEntities: false (no expansion)
 *  - small valid X-Rechnung documents still parse
 */
import { describe, expect, it } from 'vitest';
import { parseInvoice } from '@/lib/invoice';
import { rejectsEntityDeclarations, parseXml } from '@/lib/invoice/parsers/shared';

const MINIMAL_VALID_UBL = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice
  xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>
  <cbc:ID>INV-001</cbc:ID>
  <cbc:IssueDate>2026-04-29</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party><cac:PartyName><cbc:Name>Seller GmbH</cbc:Name></cac:PartyName></cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party><cac:PartyName><cbc:Name>Buyer GmbH</cbc:Name></cac:PartyName></cac:Party>
  </cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:PayableAmount currencyID="EUR">100.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;

describe('rejectsEntityDeclarations', () => {
  it('returns true for <!DOCTYPE root>', () => {
    expect(rejectsEntityDeclarations('<!DOCTYPE root>\n<root/>')).toBe(true);
  });

  it('returns true for <!DOCTYPE root SYSTEM "evil.dtd">', () => {
    expect(rejectsEntityDeclarations('<!DOCTYPE root SYSTEM "evil.dtd">\n<root/>')).toBe(true);
  });

  it('returns true for <!ENTITY foo "bar"> in the prologue', () => {
    expect(rejectsEntityDeclarations('<!DOCTYPE root [<!ENTITY foo "bar">]>\n<root/>')).toBe(true);
  });

  it('case-insensitive — rejects <!doctype>', () => {
    expect(rejectsEntityDeclarations('<!doctype root>\n<root/>')).toBe(true);
  });

  it('returns false for clean XML prologue', () => {
    expect(rejectsEntityDeclarations('<?xml version="1.0"?>\n<Invoice/>')).toBe(false);
  });

  it('returns false for an XML comment that mentions DOCTYPE in plain text', () => {
    // The regex matches the literal `<!DOCTYPE` / `<!ENTITY` token, not
    // the bare word inside a comment. `<!-- mentions DOCTYPE here -->`
    // starts with `<!-`, not `<!D`, so it correctly does NOT trigger.
    expect(rejectsEntityDeclarations('<!-- mentions DOCTYPE here -->\n<Invoice/>')).toBe(false);
  });

  it('only scans the first 4 KB of the prologue (declarations after that are illegal anyway)', () => {
    // An entity declaration would be illegal after the root opens; we don't
    // waste cycles scanning the whole document.
    const filler = '<!-- ' + 'x'.repeat(4096) + ' -->';
    const xml = `${filler}\n<Invoice/>\n<!DOCTYPE evil>`;
    expect(rejectsEntityDeclarations(xml)).toBe(false);
  });
});

describe('parseInvoice — security pre-flight (#17)', () => {
  it('rejects a DOCTYPE declaration with kind=xml-entity-declarations-forbidden', () => {
    const xml = `<!DOCTYPE Invoice>\n${MINIMAL_VALID_UBL}`;
    const result = parseInvoice(xml);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('xml-entity-declarations-forbidden');
    }
  });

  it('rejects an ENTITY declaration with kind=xml-entity-declarations-forbidden', () => {
    const xml = `<!DOCTYPE Invoice [<!ENTITY foo "bar">]>\n${MINIMAL_VALID_UBL}`;
    const result = parseInvoice(xml);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('xml-entity-declarations-forbidden');
    }
  });

  it('rejects an external SYSTEM DTD reference', () => {
    const xml = `<!DOCTYPE Invoice SYSTEM "https://evil.example/inject.dtd">\n${MINIMAL_VALID_UBL}`;
    const result = parseInvoice(xml);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('xml-entity-declarations-forbidden');
    }
  });

  it('parses a clean valid X-Rechnung normally', () => {
    const result = parseInvoice(MINIMAL_VALID_UBL);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.invoice.number).toBe('INV-001');
    }
  });
});

describe('parseXml — defense in depth', () => {
  it('rejects entity declarations even when called directly (bypasses parseInvoice)', () => {
    const xml = '<!DOCTYPE evil>\n<Invoice/>';
    const result = parseXml(xml);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.detail).toMatch(/entity declarations/i);
    }
  });
});

describe('XMLParser — processEntities is disabled', () => {
  it('does NOT expand built-in numeric entities like &#65;', () => {
    // With processEntities: true, &#65; expands to "A". With it disabled,
    // the literal string survives. This is the user-visible signal that
    // processEntities is off.
    const xml = `<?xml version="1.0"?>
<Invoice
  xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>
  <cbc:ID>&#65;BC-001</cbc:ID>
  <cbc:IssueDate>2026-04-29</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party><cac:PartyName><cbc:Name>Seller GmbH</cbc:Name></cac:PartyName></cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party><cac:PartyName><cbc:Name>Buyer GmbH</cbc:Name></cac:PartyName></cac:Party>
  </cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:PayableAmount currencyID="EUR">100.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;
    const result = parseInvoice(xml);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Literal "&#65;" survives (does NOT expand to "A")
      expect(result.invoice.number).toBe('&#65;BC-001');
      expect(result.invoice.number).not.toBe('ABC-001');
    }
  });
});
