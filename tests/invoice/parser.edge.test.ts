import { describe, expect, it } from 'vitest';
import { detectSyntax, parseCII, parseInvoice, parseUBL } from '@/lib/invoice';
import { parseXml } from '@/lib/invoice/parsers/shared';

describe('detectSyntax', () => {
  it('reports unknown-root for a doc with no root elements', () => {
    const parsed = parseXml('<?xml version="1.0"?><root/>');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const doc = { '@xmlns': 'ignored' };
      const result = detectSyntax(doc);
      expect(result.syntax).toBe('unknown');
      expect(result.rootElement).toBe('(none)');
    }
  });

  it('returns unknown when the root is a primitive (no child elements)', () => {
    const result = detectSyntax({ Invoice: 'not-an-object' });
    expect(result.syntax).toBe('unknown');
  });

  it('returns unknown for an <Invoice> root without UBL signature children', () => {
    const result = detectSyntax({ Invoice: { ID: 'X' } });
    expect(result.syntax).toBe('unknown');
  });
});

describe('UBL parser — document-level allowance & charge, version warnings', () => {
  const xml = `<?xml version="1.0"?>
    <Invoice
      xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
      xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
      xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
      <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_2.3</cbc:CustomizationID>
      <cbc:ID>INV-EDGE</cbc:ID>
      <cbc:IssueDate>2026-04-22</cbc:IssueDate>
      <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
      <cac:AccountingSupplierParty>
        <cac:Party>
          <cac:PartyName><cbc:Name>Seller</cbc:Name></cac:PartyName>
          <cac:PostalAddress>
            <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
          </cac:PostalAddress>
        </cac:Party>
      </cac:AccountingSupplierParty>
      <cac:AccountingCustomerParty>
        <cac:Party>
          <cac:PartyName><cbc:Name>Buyer</cbc:Name></cac:PartyName>
          <cac:PostalAddress>
            <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
          </cac:PostalAddress>
        </cac:Party>
      </cac:AccountingCustomerParty>
      <cac:AllowanceCharge>
        <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
        <cbc:AllowanceChargeReasonCode>95</cbc:AllowanceChargeReasonCode>
        <cbc:AllowanceChargeReason>Volume discount</cbc:AllowanceChargeReason>
        <cbc:MultiplierFactorNumeric>10</cbc:MultiplierFactorNumeric>
        <cbc:Amount currencyID="EUR">10.00</cbc:Amount>
        <cbc:BaseAmount currencyID="EUR">100.00</cbc:BaseAmount>
        <cac:TaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>19.00</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:TaxCategory>
      </cac:AllowanceCharge>
      <cac:AllowanceCharge>
        <cbc:ChargeIndicator>true</cbc:ChargeIndicator>
        <cbc:AllowanceChargeReason>Shipping</cbc:AllowanceChargeReason>
        <cbc:Amount currencyID="EUR">5.00</cbc:Amount>
      </cac:AllowanceCharge>
      <cac:LegalMonetaryTotal>
        <cbc:PayableAmount currencyID="EUR">0.00</cbc:PayableAmount>
      </cac:LegalMonetaryTotal>
    </Invoice>`;

  it('parses allowance + charge with correct signs', () => {
    const result = parseUBL(xml);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.invoice.allowancesCharges).toHaveLength(2);
      expect(result.invoice.allowancesCharges[0].isCharge).toBe(false);
      expect(result.invoice.allowancesCharges[0].amount).toBe(10);
      expect(result.invoice.allowancesCharges[0].reason).toBe('Volume discount');
      expect(result.invoice.allowancesCharges[0].reasonCode).toBe('95');
      expect(result.invoice.allowancesCharges[0].baseAmount).toBe(100);
      expect(result.invoice.allowancesCharges[0].percentage).toBe(10);
      expect(result.invoice.allowancesCharges[0].taxCategory?.code).toBe('S');
      expect(result.invoice.allowancesCharges[1].isCharge).toBe(true);
      expect(result.invoice.allowancesCharges[1].reason).toBe('Shipping');
    }
  });

  it('emits deprecated-version warning for XRechnung 2.x', () => {
    const result = parseUBL(xml);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.map((w) => w.kind)).toContain('deprecated-version');
    }
  });
});

describe('CII parser — allowance-charge, version warnings, payee', () => {
  const wrap = (customisation: string, extra = '') => `<?xml version="1.0"?>
    <rsm:CrossIndustryInvoice
      xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
      xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
      xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
      <rsm:ExchangedDocumentContext>
        <ram:GuidelineSpecifiedDocumentContextParameter>
          <ram:ID>${customisation}</ram:ID>
        </ram:GuidelineSpecifiedDocumentContextParameter>
      </rsm:ExchangedDocumentContext>
      <rsm:ExchangedDocument>
        <ram:ID>INV-CII-EDGE</ram:ID>
        <ram:TypeCode>380</ram:TypeCode>
        <ram:IssueDateTime>
          <udt:DateTimeString format="102">20260422</udt:DateTimeString>
        </ram:IssueDateTime>
      </rsm:ExchangedDocument>
      <rsm:SupplyChainTradeTransaction>
        <ram:ApplicableHeaderTradeAgreement>
          <ram:SellerTradeParty>
            <ram:Name>Seller</ram:Name>
            <ram:PostalTradeAddress><ram:CountryID>DE</ram:CountryID></ram:PostalTradeAddress>
          </ram:SellerTradeParty>
          <ram:BuyerTradeParty>
            <ram:Name>Buyer</ram:Name>
            <ram:PostalTradeAddress><ram:CountryID>DE</ram:CountryID></ram:PostalTradeAddress>
          </ram:BuyerTradeParty>
        </ram:ApplicableHeaderTradeAgreement>
        <ram:ApplicableHeaderTradeDelivery/>
        <ram:ApplicableHeaderTradeSettlement>
          <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
          ${extra}
          <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
            <ram:GrandTotalAmount>0.00</ram:GrandTotalAmount>
            <ram:DuePayableAmount>0.00</ram:DuePayableAmount>
          </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        </ram:ApplicableHeaderTradeSettlement>
      </rsm:SupplyChainTradeTransaction>
    </rsm:CrossIndustryInvoice>`;

  it('emits deprecated-version warning for XRechnung 2.x', () => {
    const result = parseCII(
      wrap('urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_2.3'),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.map((w) => w.kind)).toContain('deprecated-version');
    }
  });

  it('emits unrecognised-version warning for plain EN 16931', () => {
    const result = parseCII(wrap('urn:cen.eu:en16931:2017'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.map((w) => w.kind)).toContain('unrecognised-version');
    }
  });

  it('parses document-level allowance and charge with tax category', () => {
    const xml = wrap(
      'urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0',
      `<ram:SpecifiedTradeAllowanceCharge>
        <ram:ChargeIndicator><ram:Indicator>false</ram:Indicator></ram:ChargeIndicator>
        <ram:CalculationPercent>5</ram:CalculationPercent>
        <ram:BasisAmount>100.00</ram:BasisAmount>
        <ram:ActualAmount>5.00</ram:ActualAmount>
        <ram:ReasonCode>95</ram:ReasonCode>
        <ram:Reason>Volume discount</ram:Reason>
        <ram:CategoryTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>19.00</ram:RateApplicablePercent>
        </ram:CategoryTradeTax>
      </ram:SpecifiedTradeAllowanceCharge>
      <ram:SpecifiedTradeAllowanceCharge>
        <ram:ChargeIndicator><ram:Indicator>true</ram:Indicator></ram:ChargeIndicator>
        <ram:ActualAmount>3.00</ram:ActualAmount>
        <ram:Reason>Shipping</ram:Reason>
      </ram:SpecifiedTradeAllowanceCharge>`,
    );
    const result = parseCII(xml);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.invoice.allowancesCharges).toHaveLength(2);
      expect(result.invoice.allowancesCharges[0].isCharge).toBe(false);
      expect(result.invoice.allowancesCharges[0].amount).toBe(5);
      expect(result.invoice.allowancesCharges[0].taxCategory?.code).toBe('S');
      expect(result.invoice.allowancesCharges[1].isCharge).toBe(true);
      expect(result.invoice.allowancesCharges[1].amount).toBe(3);
    }
  });
});

describe('parseInvoice — dispatch', () => {
  it('routes the CII standard fixture to parseCII', () => {
    const xml = `<?xml version="1.0"?>
      <rsm:CrossIndustryInvoice
        xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
        xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
        xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
        <rsm:ExchangedDocument>
          <ram:ID>CII-ROUTED</ram:ID>
          <ram:TypeCode>380</ram:TypeCode>
          <ram:IssueDateTime>
            <udt:DateTimeString format="102">20260422</udt:DateTimeString>
          </ram:IssueDateTime>
        </rsm:ExchangedDocument>
        <rsm:SupplyChainTradeTransaction>
          <ram:ApplicableHeaderTradeAgreement>
            <ram:SellerTradeParty>
              <ram:Name>S</ram:Name>
              <ram:PostalTradeAddress><ram:CountryID>DE</ram:CountryID></ram:PostalTradeAddress>
            </ram:SellerTradeParty>
            <ram:BuyerTradeParty>
              <ram:Name>B</ram:Name>
              <ram:PostalTradeAddress><ram:CountryID>DE</ram:CountryID></ram:PostalTradeAddress>
            </ram:BuyerTradeParty>
          </ram:ApplicableHeaderTradeAgreement>
          <ram:ApplicableHeaderTradeDelivery/>
          <ram:ApplicableHeaderTradeSettlement>
            <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
            <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
              <ram:DuePayableAmount>0.00</ram:DuePayableAmount>
            </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
          </ram:ApplicableHeaderTradeSettlement>
        </rsm:SupplyChainTradeTransaction>
      </rsm:CrossIndustryInvoice>`;
    const result = parseInvoice(xml);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.invoice.sourceSyntax).toBe('CII');
      expect(result.invoice.number).toBe('CII-ROUTED');
    }
  });
});
