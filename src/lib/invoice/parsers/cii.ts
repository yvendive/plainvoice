import type {
  AllowanceCharge,
  ElectronicAddress,
  Invoice,
  LineItem,
  Party,
  PaymentMeans,
  TaxBreakdownRow,
  TaxCategory,
} from '../schema';
import type { ParseResult, ParseWarning } from '../types';
import { asArray, asText, parseCiiDate, roundCents, toAmount, toAmountOr } from '../helpers';
import { parseXml } from './shared';

type Record_ = Record<string, unknown>;

export function parseCII(xml: string): ParseResult {
  const parsed = parseXml(xml);
  if (!parsed.ok) return { ok: false, error: { kind: 'not-xml', detail: parsed.detail } };

  const root = parsed.doc.CrossIndustryInvoice as Record_ | undefined;
  if (!root) {
    return {
      ok: false,
      error: {
        kind: 'not-xrechnung',
        detail: 'No <CrossIndustryInvoice> root element.',
      },
    };
  }
  const warnings: ParseWarning[] = [];

  const context = (root.ExchangedDocumentContext ?? {}) as Record_;
  const customizationId = asText(
    pickPath(context, ['GuidelineSpecifiedDocumentContextParameter', 'ID']),
  );
  const profileId = asText(
    pickPath(context, ['BusinessProcessSpecifiedDocumentContextParameter', 'ID']),
  );
  checkVersion(customizationId, warnings);

  const exchangedDocument = (root.ExchangedDocument ?? {}) as Record_;
  const number = asText(exchangedDocument.ID);
  if (!number) {
    return {
      ok: false,
      error: {
        kind: 'missing-required-field',
        field: 'number',
        xpath: '/CrossIndustryInvoice/ExchangedDocument/ID',
      },
    };
  }
  const typeCode = asText(exchangedDocument.TypeCode) ?? '380';

  const issueDateNode = pickPath(exchangedDocument, ['IssueDateTime', 'DateTimeString']);
  const issueDate = parseCiiDate(issueDateNode, { field: 'issueDate', warnings });
  if (!issueDate) {
    return {
      ok: false,
      error: {
        kind: 'missing-required-field',
        field: 'issueDate',
        xpath: '/CrossIndustryInvoice/ExchangedDocument/IssueDateTime/DateTimeString',
      },
    };
  }

  const notes = asArray(exchangedDocument.IncludedNote as Record_ | Record_[] | undefined)
    .map((n) => asText(n.Content))
    .filter((n): n is string => Boolean(n));

  const transaction = (root.SupplyChainTradeTransaction ?? {}) as Record_;
  const agreement = (transaction.ApplicableHeaderTradeAgreement ?? {}) as Record_;
  const settlement = (transaction.ApplicableHeaderTradeSettlement ?? {}) as Record_;

  const currency = asText(settlement.InvoiceCurrencyCode);
  if (!currency) {
    return {
      ok: false,
      error: {
        kind: 'missing-required-field',
        field: 'currency',
        xpath: '/CrossIndustryInvoice/.../InvoiceCurrencyCode',
      },
    };
  }
  const taxCurrency = asText(settlement.TaxCurrencyCode);

  const seller = parseParty(agreement.SellerTradeParty as Record_ | undefined);
  const buyer = parseParty(agreement.BuyerTradeParty as Record_ | undefined);
  if (!seller) {
    return {
      ok: false,
      error: {
        kind: 'missing-required-field',
        field: 'seller',
        xpath: '/CrossIndustryInvoice/.../SellerTradeParty',
      },
    };
  }
  if (!buyer) {
    return {
      ok: false,
      error: {
        kind: 'missing-required-field',
        field: 'buyer',
        xpath: '/CrossIndustryInvoice/.../BuyerTradeParty',
      },
    };
  }
  const payee = parseParty(settlement.PayeeTradeParty as Record_ | undefined) ?? undefined;

  const lines: LineItem[] = asArray(
    transaction.IncludedSupplyChainTradeLineItem as Record_ | Record_[] | undefined,
  ).map((node, idx) => parseLine(node, idx));

  const allowancesCharges = asArray(
    settlement.SpecifiedTradeAllowanceCharge as Record_ | Record_[] | undefined,
  ).map(parseAllowanceCharge);

  const { taxBreakdown, taxTotal } = parseTaxBreakdown(
    asArray(settlement.ApplicableTradeTax as Record_ | Record_[] | undefined),
  );

  const paymentTerms = asArray(
    settlement.SpecifiedTradePaymentTerms as Record_ | Record_[] | undefined,
  );
  const dueDateNode = paymentTerms
    .map((t) => pickPath(t, ['DueDateDateTime', 'DateTimeString']))
    .find((n) => n !== undefined);
  const dueDate = dueDateNode
    ? parseCiiDate(dueDateNode, { field: 'dueDate', warnings })
    : undefined;
  const paymentTermsNote =
    paymentTerms
      .map((t) => asText(t.Description))
      .filter((n): n is string => Boolean(n))
      .join('\n') || undefined;

  const taxPointDateNode = pickPath(settlement, [
    'ApplicableTradeTax',
    'TaxPointDate',
    'DateString',
  ]);
  const taxPointDate = taxPointDateNode
    ? parseCiiDate(taxPointDateNode, { field: 'taxPointDate', warnings })
    : undefined;

  const totalsNode = (settlement.SpecifiedTradeSettlementHeaderMonetarySummation ?? {}) as Record_;
  const totals = {
    lineNetTotal: toAmountOr(
      totalsNode.LineTotalAmount,
      lines.reduce((acc, l) => acc + l.netAmount, 0),
    ),
    allowanceTotal: toAmountOr(
      totalsNode.AllowanceTotalAmount,
      allowancesCharges.filter((ac) => !ac.isCharge).reduce((acc, ac) => acc + ac.amount, 0),
    ),
    chargeTotal: toAmountOr(
      totalsNode.ChargeTotalAmount,
      allowancesCharges.filter((ac) => ac.isCharge).reduce((acc, ac) => acc + ac.amount, 0),
    ),
    taxExclusive: toAmountOr(totalsNode.TaxBasisTotalAmount, 0),
    taxTotal: toAmount(totalsNode.TaxTotalAmount) ?? taxTotal,
    taxInclusive: toAmountOr(totalsNode.GrandTotalAmount, 0),
    paidAmount: toAmount(totalsNode.TotalPrepaidAmount) ?? 0,
    roundingAmount: toAmount(totalsNode.RoundingAmount) ?? 0,
    amountDue: toAmountOr(totalsNode.DuePayableAmount, 0),
  };

  const paymentMeans = asArray(
    settlement.SpecifiedTradeSettlementPaymentMeans as Record_ | Record_[] | undefined,
  ).map(parsePaymentMeans);

  const invoice: Invoice = {
    number,
    typeCode,
    issueDate,
    dueDate,
    taxPointDate,
    currency,
    taxCurrency,
    buyerReference: asText(agreement.BuyerReference),
    purchaseOrderReference: asText(
      pickPath(agreement, ['BuyerOrderReferencedDocument', 'IssuerAssignedID']),
    ),
    contractReference: asText(
      pickPath(agreement, ['ContractReferencedDocument', 'IssuerAssignedID']),
    ),
    projectReference: asText(
      pickPath(agreement, ['SpecifiedProcuringProject', 'ID']),
    ),
    notes,
    seller,
    buyer,
    payee,
    lines,
    allowancesCharges,
    taxBreakdown,
    totals,
    paymentMeans,
    paymentTermsNote,
    sourceSyntax: 'CII',
    customizationId,
    profileId,
  };

  return { ok: true, invoice, warnings };
}

function pickPath(node: unknown, path: string[]): unknown {
  let cursor: unknown = node;
  for (const segment of path) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record_)[segment];
  }
  return cursor;
}

function parseParty(node: Record_ | undefined): Party | null {
  if (!node) return null;
  const name =
    asText(node.Name) ??
    asText(pickPath(node, ['SpecifiedLegalOrganization', 'TradingBusinessName']));
  if (!name) return null;

  const address = (node.PostalTradeAddress ?? {}) as Record_;
  const countryCode = asText(address.CountryID) ?? 'XX';

  const taxRegistrations = asArray(
    node.SpecifiedTaxRegistration as Record_ | Record_[] | undefined,
  );
  let vatId: string | undefined;
  let taxId: string | undefined;
  for (const reg of taxRegistrations) {
    const idNode = reg.ID as Record_ | string | undefined;
    const scheme =
      typeof idNode === 'object' && idNode !== null
        ? asText((idNode as Record_).schemeID)
        : undefined;
    const value = asText(idNode);
    if (!value) continue;
    if (scheme === 'VA' && !vatId) vatId = value;
    else if (scheme === 'FC' && !taxId) taxId = value;
    else if (!vatId) vatId = value;
  }

  const contactNode = node.DefinedTradeContact as Record_ | undefined;
  const contact = contactNode
    ? {
        name: asText(contactNode.PersonName) ?? asText(contactNode.DepartmentName),
        email: asText(
          pickPath(contactNode, ['EmailURIUniversalCommunication', 'URIID']),
        ),
        phone: asText(
          pickPath(contactNode, ['TelephoneUniversalCommunication', 'CompleteNumber']),
        ),
      }
    : undefined;

  const electronicAddress = parseUriUniversalCommunication(
    node.URIUniversalCommunication as Record_ | undefined,
  );

  return {
    name,
    vatId,
    taxId,
    address: {
      street: asText(address.LineOne),
      additionalStreet: asText(address.LineTwo),
      city: asText(address.CityName),
      postalCode: asText(address.PostcodeCode),
      countryCode,
    },
    contact,
    electronicAddress,
  };
}

function parseUriUniversalCommunication(
  node: Record_ | undefined,
): ElectronicAddress | undefined {
  if (!node) return undefined;
  const idNode = node.URIID as Record_ | string | undefined;
  if (!idNode) return undefined;
  if (typeof idNode === 'string') return { scheme: 'EM', value: idNode };
  const record = idNode as Record_;
  const value = asText(record['#text']);
  const scheme = asText(record.schemeID);
  if (!value) return undefined;
  return { scheme: scheme ?? 'EM', value };
}

function parseLine(node: Record_, index: number): LineItem {
  const assocDoc = (node.AssociatedDocumentLineDocument ?? {}) as Record_;
  const id = asText(assocDoc.LineID) ?? String(index + 1);
  const note = asText(pickPath(assocDoc, ['IncludedNote', 'Content']));

  const product = (node.SpecifiedTradeProduct ?? {}) as Record_;
  const lineAgreement = (node.SpecifiedLineTradeAgreement ?? {}) as Record_;
  const lineDelivery = (node.SpecifiedLineTradeDelivery ?? {}) as Record_;
  const lineSettlement = (node.SpecifiedLineTradeSettlement ?? {}) as Record_;

  const unitPrice =
    toAmount(pickPath(lineAgreement, ['NetPriceProductTradePrice', 'ChargeAmount'])) ??
    toAmount(pickPath(lineAgreement, ['GrossPriceProductTradePrice', 'ChargeAmount'])) ??
    0;
  const quantityNode = lineDelivery.BilledQuantity;
  const quantity = toAmountOr(quantityNode, 0);
  const unitCode =
    asText(
      typeof quantityNode === 'object' && quantityNode !== null
        ? (quantityNode as Record_).unitCode
        : undefined,
    ) ?? 'C62';

  const taxCategory = parseLineTaxCategory(
    lineSettlement.ApplicableTradeTax as Record_ | undefined,
  );
  const netAmount = toAmountOr(
    pickPath(lineSettlement, [
      'SpecifiedTradeSettlementLineMonetarySummation',
      'LineTotalAmount',
    ]),
    0,
  );

  return {
    id,
    name: asText(product.Name) ?? '',
    description: asText(product.Description),
    sellerItemId: asText(product.SellerAssignedID),
    buyerItemId: asText(product.BuyerAssignedID),
    standardItemId: asText(product.GlobalID),
    quantity,
    unitCode,
    unitPrice,
    netAmount,
    taxCategory,
    note,
  };
}

function parseLineTaxCategory(node: Record_ | undefined): TaxCategory {
  if (!node) return { code: 'S', rate: 0 };
  return {
    code: asText(node.CategoryCode) ?? 'S',
    rate: toAmount(node.RateApplicablePercent) ?? 0,
    exemptionReason: asText(node.ExemptionReason),
  };
}

function parseAllowanceCharge(node: Record_): AllowanceCharge {
  const isCharge = asText(node.ChargeIndicator) === 'true'
    || asText(pickPath(node, ['ChargeIndicator', 'Indicator'])) === 'true';
  const taxNode = node.CategoryTradeTax as Record_ | undefined;
  return {
    isCharge,
    amount: toAmountOr(node.ActualAmount, 0),
    baseAmount: toAmount(node.BasisAmount),
    percentage: toAmount(node.CalculationPercent),
    reason: asText(node.Reason),
    reasonCode: asText(node.ReasonCode),
    taxCategory: taxNode
      ? {
          code: asText(taxNode.CategoryCode) ?? 'S',
          rate: toAmount(taxNode.RateApplicablePercent) ?? 0,
          exemptionReason: asText(taxNode.ExemptionReason),
        }
      : undefined,
  };
}

function parseTaxBreakdown(nodes: Record_[]): {
  taxBreakdown: TaxBreakdownRow[];
  taxTotal: number;
} {
  const rows: TaxBreakdownRow[] = [];
  for (const node of nodes) {
    rows.push({
      category: {
        code: asText(node.CategoryCode) ?? 'S',
        rate: toAmount(node.RateApplicablePercent) ?? 0,
        exemptionReason: asText(node.ExemptionReason),
      },
      taxableAmount: toAmountOr(node.BasisAmount, 0),
      taxAmount: toAmountOr(node.CalculatedAmount, 0),
    });
  }
  const taxTotal = roundCents(rows.reduce((acc, r) => acc + r.taxAmount, 0));
  return { taxBreakdown: rows, taxTotal };
}

function parsePaymentMeans(node: Record_): PaymentMeans {
  const creditorAccount = (node.PayeePartyCreditorFinancialAccount ?? {}) as Record_;
  const creditorInstitution = (node.PayeeSpecifiedCreditorFinancialInstitution ?? {}) as Record_;
  return {
    typeCode: asText(node.TypeCode) ?? '',
    iban: asText(creditorAccount.IBANID) ?? asText(creditorAccount.ProprietaryID),
    bic: asText(creditorInstitution.BICID),
    accountHolder: asText(creditorAccount.AccountName),
    mandateReference: asText(
      pickPath(node, ['PayerPartyDebtorFinancialAccount', 'ProprietaryID']),
    ),
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
