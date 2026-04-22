import type {
  AllowanceCharge,
  Invoice,
  LineItem,
  Party,
  PaymentMeans,
  TaxBreakdownRow,
  TaxCategory,
} from '../schema';
import type { ParseResult, ParseWarning } from '../types';
import { asArray, asText, roundCents, toAmount, toAmountOr, toIsoDate } from '../helpers';
import { parseXml } from './shared';

type Record_ = Record<string, unknown>;

type Variant = 'Invoice' | 'CreditNote';

export function parseUBL(xml: string): ParseResult {
  const parsed = parseXml(xml);
  if (!parsed.ok) return { ok: false, error: { kind: 'not-xml', detail: parsed.detail } };

  const root = (parsed.doc.Invoice ?? parsed.doc.CreditNote) as Record_ | undefined;
  if (!root) {
    return {
      ok: false,
      error: {
        kind: 'not-xrechnung',
        detail: 'No <Invoice> or <CreditNote> root element.',
      },
    };
  }
  const variant: Variant = parsed.doc.Invoice ? 'Invoice' : 'CreditNote';
  const warnings: ParseWarning[] = [];

  const number = asText(root.ID);
  if (!number) {
    return {
      ok: false,
      error: { kind: 'missing-required-field', field: 'number', xpath: '/Invoice/ID' },
    };
  }

  const issueDate = toIsoDate(root.IssueDate);
  if (!issueDate) {
    return {
      ok: false,
      error: { kind: 'missing-required-field', field: 'issueDate', xpath: '/Invoice/IssueDate' },
    };
  }

  const currency = asText(root.DocumentCurrencyCode);
  if (!currency) {
    return {
      ok: false,
      error: {
        kind: 'missing-required-field',
        field: 'currency',
        xpath: '/Invoice/DocumentCurrencyCode',
      },
    };
  }

  const typeCodeElement = variant === 'Invoice' ? 'InvoiceTypeCode' : 'CreditNoteTypeCode';
  const typeCode = asText(root[typeCodeElement]) ?? (variant === 'Invoice' ? '380' : '381');

  const customizationId = asText(root.CustomizationID);
  const profileId = asText(root.ProfileID);
  checkVersion(customizationId, warnings);

  const seller = parseParty(pickParty(root, 'AccountingSupplierParty'), 'seller');
  const buyer = parseParty(pickParty(root, 'AccountingCustomerParty'), 'buyer');
  if (!seller) {
    return {
      ok: false,
      error: {
        kind: 'missing-required-field',
        field: 'seller',
        xpath: '/Invoice/AccountingSupplierParty',
      },
    };
  }
  if (!buyer) {
    return {
      ok: false,
      error: {
        kind: 'missing-required-field',
        field: 'buyer',
        xpath: '/Invoice/AccountingCustomerParty',
      },
    };
  }
  const payee = parseParty(pickParty(root, 'PayeeParty', { bareRoot: true }), 'payee') ?? undefined;

  const lineTag = variant === 'Invoice' ? 'InvoiceLine' : 'CreditNoteLine';
  const quantityTag = variant === 'Invoice' ? 'InvoicedQuantity' : 'CreditedQuantity';
  const lines: LineItem[] = asArray(root[lineTag] as Record_ | Record_[] | undefined).map(
    (line, idx) => parseLine(line, quantityTag, idx),
  );

  const docLevelAllowances = asArray(
    root.AllowanceCharge as Record_ | Record_[] | undefined,
  ).map(parseAllowanceCharge);

  const { taxBreakdown, taxTotal } = parseTaxTotals(
    asArray(root.TaxTotal as Record_ | Record_[] | undefined),
  );

  const totalsNode = (root.LegalMonetaryTotal ?? {}) as Record_;
  const totals = {
    lineNetTotal: toAmountOr(
      totalsNode.LineExtensionAmount,
      lines.reduce((acc, l) => acc + l.netAmount, 0),
    ),
    allowanceTotal: toAmountOr(
      totalsNode.AllowanceTotalAmount,
      docLevelAllowances
        .filter((ac) => !ac.isCharge)
        .reduce((acc, ac) => acc + ac.amount, 0),
    ),
    chargeTotal: toAmountOr(
      totalsNode.ChargeTotalAmount,
      docLevelAllowances.filter((ac) => ac.isCharge).reduce((acc, ac) => acc + ac.amount, 0),
    ),
    taxExclusive: toAmountOr(totalsNode.TaxExclusiveAmount, 0),
    taxTotal,
    taxInclusive: toAmountOr(totalsNode.TaxInclusiveAmount, 0),
    paidAmount: toAmount(totalsNode.PrepaidAmount) ?? 0,
    roundingAmount: toAmount(totalsNode.PayableRoundingAmount) ?? 0,
    amountDue: toAmountOr(totalsNode.PayableAmount, 0),
  };

  const paymentMeans = asArray(
    root.PaymentMeans as Record_ | Record_[] | undefined,
  ).map(parsePaymentMeans);

  const paymentTermsNote =
    asArray(root.PaymentTerms as Record_ | Record_[] | undefined)
      .map((t) => asText(t.Note))
      .filter((n): n is string => Boolean(n))
      .join('\n') || undefined;

  const notes = asArray(root.Note as unknown)
    .map((n) => asText(n))
    .filter((n): n is string => Boolean(n));

  const invoice: Invoice = {
    number,
    typeCode,
    issueDate,
    dueDate: toIsoDate(root.DueDate),
    taxPointDate: toIsoDate(root.TaxPointDate),
    currency,
    taxCurrency: asText(root.TaxCurrencyCode),
    buyerReference: asText(root.BuyerReference),
    purchaseOrderReference: asText(pickRef(root.OrderReference)),
    contractReference: asText(pickRef(root.ContractDocumentReference)),
    projectReference: asText(pickRef(root.ProjectReference)),
    notes,
    seller,
    buyer,
    payee,
    lines,
    allowancesCharges: docLevelAllowances,
    taxBreakdown,
    totals,
    paymentMeans,
    paymentTermsNote,
    sourceSyntax: 'UBL',
    customizationId,
    profileId,
  };

  return { ok: true, invoice, warnings };
}

function pickRef(node: unknown): unknown {
  if (!node) return undefined;
  if (typeof node === 'object') return (node as Record_).ID;
  return node;
}

function pickParty(
  root: Record_,
  wrapper: string,
  options: { bareRoot?: boolean } = {},
): Record_ | undefined {
  const node = root[wrapper];
  if (!node || typeof node !== 'object') return undefined;
  if (options.bareRoot) return node as Record_;
  const party = (node as Record_).Party;
  return party && typeof party === 'object' ? (party as Record_) : undefined;
}

function parseParty(node: Record_ | undefined, fieldName: string): Party | null {
  if (!node) return fieldName === 'payee' ? null : null;
  const name =
    asText(pickPath(node, ['PartyName', 'Name'])) ??
    asText(pickPath(node, ['PartyLegalEntity', 'RegistrationName'])) ??
    asText(node.Name);
  if (!name) return null;

  const address = (node.PostalAddress ?? {}) as Record_;
  const countryNode = (address.Country ?? {}) as Record_;
  const countryCode = asText(countryNode.IdentificationCode) ?? 'XX';

  const partyTaxSchemes = asArray(node.PartyTaxScheme as Record_ | Record_[] | undefined);
  const vatId = partyTaxSchemes
    .map((pts) => {
      const scheme = asText(pickPath(pts, ['TaxScheme', 'ID']));
      return scheme === 'VAT' ? asText(pts.CompanyID) : undefined;
    })
    .find(Boolean);
  const taxId = partyTaxSchemes
    .map((pts) => {
      const scheme = asText(pickPath(pts, ['TaxScheme', 'ID']));
      return scheme && scheme !== 'VAT' ? asText(pts.CompanyID) : undefined;
    })
    .find(Boolean);

  const contactNode = node.Contact as Record_ | undefined;
  const contact = contactNode
    ? {
        name: asText(contactNode.Name),
        email: asText(contactNode.ElectronicMail),
        phone: asText(contactNode.Telephone),
      }
    : undefined;

  const endpointNode = node.EndpointID as Record_ | string | undefined;
  const electronicAddress = parseEndpointId(endpointNode);

  return {
    name,
    vatId,
    taxId,
    address: {
      street: asText(address.StreetName),
      additionalStreet: asText(address.AdditionalStreetName),
      city: asText(address.CityName),
      postalCode: asText(address.PostalZone),
      countryCode,
    },
    contact,
    electronicAddress,
  };
}

function parseEndpointId(node: unknown): Party['electronicAddress'] {
  if (!node) return undefined;
  if (typeof node === 'string') return { scheme: 'EM', value: node };
  if (typeof node === 'object') {
    const record = node as Record_;
    const value = asText(record['#text']);
    const scheme = asText(record.schemeID);
    if (value) return { scheme: scheme ?? 'EM', value };
  }
  return undefined;
}

function pickPath(node: Record_ | undefined, path: string[]): unknown {
  let cursor: unknown = node;
  for (const segment of path) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record_)[segment];
  }
  return cursor;
}

function parseLine(node: Record_, quantityTag: string, index: number): LineItem {
  const id = asText(node.ID) ?? String(index + 1);
  const item = (node.Item ?? {}) as Record_;
  const priceNode = (node.Price ?? {}) as Record_;

  const taxCategory = parseClassifiedTaxCategory(
    item.ClassifiedTaxCategory as Record_ | undefined,
  );

  return {
    id,
    name: asText(item.Name) ?? '',
    description: asText(item.Description),
    sellerItemId: asText(pickPath(item, ['SellersItemIdentification', 'ID'])),
    buyerItemId: asText(pickPath(item, ['BuyersItemIdentification', 'ID'])),
    standardItemId: asText(pickPath(item, ['StandardItemIdentification', 'ID'])),
    quantity: toAmountOr(node[quantityTag], 0),
    unitCode: asText(unitCodeAttr(node[quantityTag])) ?? 'C62',
    unitPrice: toAmountOr(priceNode.PriceAmount, 0),
    netAmount: toAmountOr(node.LineExtensionAmount, 0),
    taxCategory,
    note: asText(node.Note),
  };
}

function unitCodeAttr(node: unknown): unknown {
  if (!node || typeof node !== 'object') return undefined;
  return (node as Record_).unitCode;
}

function parseClassifiedTaxCategory(node: Record_ | undefined): TaxCategory {
  if (!node) return { code: 'S', rate: 0 };
  return {
    code: asText(node.ID) ?? 'S',
    rate: toAmount(node.Percent) ?? 0,
    exemptionReason: asText(node.TaxExemptionReason),
  };
}

function parseAllowanceCharge(node: Record_): AllowanceCharge {
  const isCharge = asText(node.ChargeIndicator) === 'true';
  return {
    isCharge,
    amount: toAmountOr(node.Amount, 0),
    baseAmount: toAmount(node.BaseAmount),
    percentage: toAmount(node.MultiplierFactorNumeric),
    reason: asText(node.AllowanceChargeReason),
    reasonCode: asText(node.AllowanceChargeReasonCode),
    taxCategory: node.TaxCategory
      ? parseClassifiedTaxCategory(node.TaxCategory as Record_)
      : undefined,
  };
}

function parseTaxTotals(nodes: Record_[]): {
  taxBreakdown: TaxBreakdownRow[];
  taxTotal: number;
} {
  const rows: TaxBreakdownRow[] = [];
  let taxTotal = 0;
  for (const total of nodes) {
    taxTotal += toAmount(total.TaxAmount) ?? 0;
    const subs = asArray(total.TaxSubtotal as Record_ | Record_[] | undefined);
    for (const sub of subs) {
      const category = sub.TaxCategory as Record_ | undefined;
      rows.push({
        category: parseClassifiedTaxCategory(category),
        taxableAmount: toAmountOr(sub.TaxableAmount, 0),
        taxAmount: toAmountOr(sub.TaxAmount, 0),
      });
    }
  }
  // Fall back to the sum of breakdown rows when the header TaxAmount is
  // missing (some producers omit it even though EN 16931 requires it).
  if (taxTotal === 0 && rows.length > 0) {
    taxTotal = roundCents(rows.reduce((acc, r) => acc + r.taxAmount, 0));
  }
  return { taxBreakdown: rows, taxTotal };
}

function parsePaymentMeans(node: Record_): PaymentMeans {
  const account = (node.PayeeFinancialAccount ?? {}) as Record_;
  const branch = (account.FinancialInstitutionBranch ?? {}) as Record_;
  return {
    typeCode: asText(node.PaymentMeansCode) ?? '',
    iban: asText(account.ID),
    bic: asText(branch.ID),
    accountHolder: asText(account.Name),
    mandateReference: asText(pickPath(node, ['PaymentMandate', 'ID'])),
  };
}

function checkVersion(id: string | undefined, warnings: ParseWarning[]): void {
  if (!id) return;
  const lower = id.toLowerCase();
  if (lower.includes('xrechnung_3.0')) return;
  if (lower.includes('xrechnung_2')) {
    warnings.push({
      kind: 'deprecated-version',
      detail: `XRechnung 2.x customisation detected (${id}). Still parseable; consider upgrading.`,
    });
    return;
  }
  if (lower.includes('en16931')) {
    warnings.push({
      kind: 'unrecognised-version',
      detail: `EN 16931-compliant profile without an XRechnung marker: ${id}`,
    });
  }
}
