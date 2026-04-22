import { describe, expect, it } from 'vitest';
import { parseCII, parseInvoice, parseUBL } from '@/lib/invoice';

describe('parseInvoice — error paths', () => {
  it('reports not-xml for empty input', () => {
    const result = parseInvoice('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('not-xml');
  });

  it('reports not-xml for plainly broken XML', () => {
    const result = parseInvoice('<not xml');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('not-xml');
  });

  it('reports unknown-syntax for valid XML that is not an X-Rechnung', () => {
    const rss = `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>News</title>
        </channel>
      </rss>`;
    const result = parseInvoice(rss);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('unknown-syntax');
      if (result.error.kind === 'unknown-syntax') {
        expect(result.error.rootElement).toBe('rss');
      }
    }
  });

  it('reports unknown-syntax for a UBL root with a foreign namespace', () => {
    const alien = `<?xml version="1.0"?>
      <Invoice xmlns="http://example.com/not-ubl">
        <ID>X</ID>
      </Invoice>`;
    const result = parseInvoice(alien);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('unknown-syntax');
  });
});

describe('parseUBL — missing required fields', () => {
  it('reports missing number when <cbc:ID> is absent', () => {
    const xml = `<?xml version="1.0"?>
      <Invoice
        xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
        xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
        <cbc:IssueDate>2026-01-01</cbc:IssueDate>
        <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
      </Invoice>`;
    const result = parseUBL(xml);
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'missing-required-field') {
      expect(result.error.field).toBe('number');
    } else {
      throw new Error(`Expected missing-required-field, got ${JSON.stringify(result)}`);
    }
  });

  it('reports missing issueDate when <cbc:IssueDate> is absent', () => {
    const xml = `<?xml version="1.0"?>
      <Invoice
        xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
        xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
        <cbc:ID>X</cbc:ID>
        <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
      </Invoice>`;
    const result = parseUBL(xml);
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'missing-required-field') {
      expect(result.error.field).toBe('issueDate');
    }
  });

  it('reports missing currency', () => {
    const xml = `<?xml version="1.0"?>
      <Invoice
        xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
        xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
        <cbc:ID>X</cbc:ID>
        <cbc:IssueDate>2026-01-01</cbc:IssueDate>
      </Invoice>`;
    const result = parseUBL(xml);
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'missing-required-field') {
      expect(result.error.field).toBe('currency');
    }
  });

  it('reports missing seller when no AccountingSupplierParty is given', () => {
    const xml = `<?xml version="1.0"?>
      <Invoice
        xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
        xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
        <cbc:ID>X</cbc:ID>
        <cbc:IssueDate>2026-01-01</cbc:IssueDate>
        <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
      </Invoice>`;
    const result = parseUBL(xml);
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'missing-required-field') {
      expect(result.error.field).toBe('seller');
    }
  });

  it('reports not-xrechnung when neither Invoice nor CreditNote root is present', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>X</title></channel></rss>`;
    const result = parseUBL(xml);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('not-xrechnung');
  });
});

describe('parseCII — missing required fields', () => {
  const wrap = (body: string) => `<?xml version="1.0"?>
    <rsm:CrossIndustryInvoice
      xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
      xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
      xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
      ${body}
    </rsm:CrossIndustryInvoice>`;

  it('reports missing number', () => {
    const result = parseCII(
      wrap(`
        <rsm:ExchangedDocument>
          <ram:TypeCode>380</ram:TypeCode>
          <ram:IssueDateTime>
            <udt:DateTimeString format="102">20260422</udt:DateTimeString>
          </ram:IssueDateTime>
        </rsm:ExchangedDocument>
      `),
    );
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'missing-required-field') {
      expect(result.error.field).toBe('number');
    }
  });

  it('reports missing issueDate', () => {
    const result = parseCII(
      wrap(`
        <rsm:ExchangedDocument>
          <ram:ID>INV-X</ram:ID>
          <ram:TypeCode>380</ram:TypeCode>
        </rsm:ExchangedDocument>
      `),
    );
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'missing-required-field') {
      expect(result.error.field).toBe('issueDate');
    }
  });

  it('reports not-xrechnung when the CII root is missing', () => {
    const result = parseCII('<?xml version="1.0"?><something/>');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('not-xrechnung');
  });

  it('reports not-xml for garbage input', () => {
    const result = parseCII('<<not xml');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('not-xml');
  });
});

describe('version warnings', () => {
  const ublWithCustomisation = (id: string) => `<?xml version="1.0"?>
    <Invoice
      xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
      xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
      xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
      <cbc:CustomizationID>${id}</cbc:CustomizationID>
      <cbc:ID>INV-Y</cbc:ID>
      <cbc:IssueDate>2026-01-01</cbc:IssueDate>
      <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
      <cac:AccountingSupplierParty>
        <cac:Party>
          <cac:PartyName><cbc:Name>S</cbc:Name></cac:PartyName>
          <cac:PostalAddress>
            <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
          </cac:PostalAddress>
        </cac:Party>
      </cac:AccountingSupplierParty>
      <cac:AccountingCustomerParty>
        <cac:Party>
          <cac:PartyName><cbc:Name>B</cbc:Name></cac:PartyName>
          <cac:PostalAddress>
            <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
          </cac:PostalAddress>
        </cac:Party>
      </cac:AccountingCustomerParty>
      <cac:LegalMonetaryTotal>
        <cbc:PayableAmount currencyID="EUR">0.00</cbc:PayableAmount>
      </cac:LegalMonetaryTotal>
    </Invoice>`;

  it('emits deprecated-version for XRechnung 2.x', () => {
    const result = parseInvoice(
      ublWithCustomisation(
        'urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_2.3',
      ),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.some((w) => w.kind === 'deprecated-version')).toBe(true);
    }
  });

  it('emits unrecognised-version for a plain EN 16931 profile', () => {
    const result = parseInvoice(
      ublWithCustomisation('urn:cen.eu:en16931:2017'),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.some((w) => w.kind === 'unrecognised-version')).toBe(true);
    }
  });
});
