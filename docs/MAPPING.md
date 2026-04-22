# XML → `Invoice` field mapping

This document is the canonical reference for how each field of the
`Invoice` model (see `src/lib/invoice/schema.ts`) is populated from the
two X-Rechnung dialects the parser supports:

- **UBL** — OASIS Universal Business Language (roots `<Invoice>` and
  `<CreditNote>`).
- **CII** — UN/CEFACT Cross-Industry Invoice (root
  `<rsm:CrossIndustryInvoice>`).

The parsers strip namespace prefixes via `removeNSPrefix: true` from
`fast-xml-parser`, so the XPaths below are shown **without** prefixes
(e.g. `Invoice/ID`, not `ubl:Invoice/cbc:ID`). Real documents will have
prefixes — the parser normalises them away before matching.

The "EN 16931 BT" column references the business-term identifier from
the EN 16931 semantic data model. Use these as the stable cross-format
vocabulary when porting the parser, producing new formats, or
reviewing against the official standard.

---

## 1. UBL → `Invoice`

Root element is either `<Invoice>` (type code 380, 384, …) or
`<CreditNote>` (type code 381). The two variants share the same body
with three differences that the parser handles internally:

| Variant     | Root          | Type-code element    | Line element        | Quantity element    |
| ----------- | ------------- | -------------------- | ------------------- | ------------------- |
| Invoice     | `Invoice`     | `InvoiceTypeCode`    | `InvoiceLine`       | `InvoicedQuantity`  |
| Credit Note | `CreditNote`  | `CreditNoteTypeCode` | `CreditNoteLine`    | `CreditedQuantity`  |

### 1.1 Document-level fields

| Invoice field             | EN 16931 BT   | UBL XPath                                         | Notes                                                          |
| ------------------------- | ------------- | ------------------------------------------------- | -------------------------------------------------------------- |
| `number`                  | BT-1          | `/Invoice/ID`                                     | Required. Missing → `missing-required-field`.                  |
| `typeCode`                | BT-3          | `/Invoice/InvoiceTypeCode`                        | Falls back to `380` / `381` if absent.                         |
| `issueDate`               | BT-2          | `/Invoice/IssueDate`                              | ISO `YYYY-MM-DD`; datetimes are truncated to the date portion. |
| `dueDate`                 | BT-9          | `/Invoice/DueDate`                                |                                                                |
| `taxPointDate`            | BT-7          | `/Invoice/TaxPointDate`                           |                                                                |
| `currency`                | BT-5          | `/Invoice/DocumentCurrencyCode`                   | Required.                                                      |
| `taxCurrency`             | BT-6          | `/Invoice/TaxCurrencyCode`                        |                                                                |
| `buyerReference`          | BT-10         | `/Invoice/BuyerReference`                         | Leitweg-ID for DE public-sector.                               |
| `purchaseOrderReference`  | BT-13         | `/Invoice/OrderReference/ID`                      |                                                                |
| `contractReference`       | BT-12         | `/Invoice/ContractDocumentReference/ID`           |                                                                |
| `projectReference`        | BT-11         | `/Invoice/ProjectReference/ID`                    |                                                                |
| `notes`                   | BT-22         | `/Invoice/Note`                                   | All top-level `<Note>` elements are collected into an array.   |
| `customizationId`         | BT-24         | `/Invoice/CustomizationID`                        | Used for version detection (XRechnung 3.0 vs 2.x).             |
| `profileId`               | BT-23         | `/Invoice/ProfileID`                              |                                                                |
| `sourceSyntax`            | —             | constant `'UBL'`                                  | Provenance for the UI and output layers.                       |

### 1.2 Parties

Shared mapping for `seller`, `buyer`, and `payee`. UBL wraps each under
`<AccountingSupplierParty>/<Party>`, `<AccountingCustomerParty>/<Party>`,
or `<PayeeParty>` respectively.

| Party field                 | EN 16931 BT    | UBL XPath (relative to `<Party>`)                            | Notes                                                               |
| --------------------------- | -------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `name`                      | BT-27 / BT-44  | `PartyName/Name`                                             | Falls back to `PartyLegalEntity/RegistrationName` then `Name`.      |
| `vatId`                     | BT-31 / BT-48  | `PartyTaxScheme/CompanyID` (where `TaxScheme/ID = "VAT"`)    |                                                                     |
| `taxId`                     | BT-32 / BT-49  | `PartyTaxScheme/CompanyID` (other schemes)                   |                                                                     |
| `address.street`            | BT-35 / BT-50  | `PostalAddress/StreetName`                                   |                                                                     |
| `address.additionalStreet`  | BT-36 / BT-51  | `PostalAddress/AdditionalStreetName`                         |                                                                     |
| `address.city`              | BT-37 / BT-52  | `PostalAddress/CityName`                                     |                                                                     |
| `address.postalCode`        | BT-38 / BT-53  | `PostalAddress/PostalZone`                                   |                                                                     |
| `address.countryCode`       | BT-40 / BT-55  | `PostalAddress/Country/IdentificationCode`                   | ISO 3166-1 alpha-2; falls back to `"XX"` so the schema stays valid. |
| `contact.name`              | BT-41 / BT-56  | `Contact/Name`                                               |                                                                     |
| `contact.email`             | BT-43 / BT-58  | `Contact/ElectronicMail`                                     |                                                                     |
| `contact.phone`             | BT-42 / BT-57  | `Contact/Telephone`                                          |                                                                     |
| `electronicAddress.scheme`  | BT-34 / BT-49  | `EndpointID/@schemeID`                                       | Peppol / EAS code. Defaults to `"EM"` (email) when absent.          |
| `electronicAddress.value`   | BT-34 / BT-49  | `EndpointID` (text)                                          |                                                                     |

### 1.3 Lines

Each `<InvoiceLine>` (or `<CreditNoteLine>`) becomes one entry in
`invoice.lines`.

| LineItem field    | EN 16931 BT | UBL XPath (relative to line node)                     | Notes                                          |
| ----------------- | ----------- | ----------------------------------------------------- | ---------------------------------------------- |
| `id`              | BT-126      | `ID`                                                  | Falls back to the 1-based index.               |
| `name`            | BT-153      | `Item/Name`                                           |                                                |
| `description`     | BT-154      | `Item/Description`                                    |                                                |
| `sellerItemId`    | BT-155      | `Item/SellersItemIdentification/ID`                   |                                                |
| `buyerItemId`     | BT-156      | `Item/BuyersItemIdentification/ID`                    |                                                |
| `standardItemId`  | BT-157      | `Item/StandardItemIdentification/ID`                  | Typically GTIN/EAN.                            |
| `quantity`        | BT-129      | `InvoicedQuantity` / `CreditedQuantity`               |                                                |
| `unitCode`        | BT-130      | `InvoicedQuantity/@unitCode` / `CreditedQuantity/@unitCode` | UNECE Rec 20; defaults to `C62` (piece). |
| `unitPrice`       | BT-146      | `Price/PriceAmount`                                   |                                                |
| `netAmount`       | BT-131      | `LineExtensionAmount`                                 |                                                |
| `taxCategory`     | BT-151/152  | `Item/ClassifiedTaxCategory` (`ID`, `Percent`, `TaxExemptionReason`) | UNCL 5305 category code.        |
| `note`            | BT-127      | `Note`                                                |                                                |

### 1.4 Document-level allowances / charges

Iterates over all top-level `<AllowanceCharge>` elements.

| AllowanceCharge field | EN 16931 BT | UBL XPath                        | Notes                                       |
| --------------------- | ----------- | -------------------------------- | ------------------------------------------- |
| `isCharge`            | BT-94/99    | `ChargeIndicator`                | `"true"` = surcharge, `"false"` = discount. |
| `amount`              | BT-92/99    | `Amount`                         |                                             |
| `baseAmount`          | BT-93/100   | `BaseAmount`                     |                                             |
| `percentage`          | BT-94/101   | `MultiplierFactorNumeric`        |                                             |
| `reason`              | BT-97/104   | `AllowanceChargeReason`          |                                             |
| `reasonCode`          | BT-98/105   | `AllowanceChargeReasonCode`      |                                             |
| `taxCategory`         | BT-95/102   | `TaxCategory/ID`, `/Percent`     |                                             |

### 1.5 Tax breakdown and totals

| Invoice field                 | EN 16931 BT | UBL XPath                                                     | Notes                                                                                  |
| ----------------------------- | ----------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `taxBreakdown[].category`     | BT-118      | `TaxTotal/TaxSubtotal/TaxCategory`                            |                                                                                        |
| `taxBreakdown[].taxableAmount`| BT-116      | `TaxTotal/TaxSubtotal/TaxableAmount`                          |                                                                                        |
| `taxBreakdown[].taxAmount`    | BT-117      | `TaxTotal/TaxSubtotal/TaxAmount`                              |                                                                                        |
| `totals.lineNetTotal`         | BT-106      | `LegalMonetaryTotal/LineExtensionAmount`                      |                                                                                        |
| `totals.allowanceTotal`       | BT-107      | `LegalMonetaryTotal/AllowanceTotalAmount`                     | Falls back to summed allowances when absent.                                           |
| `totals.chargeTotal`          | BT-108      | `LegalMonetaryTotal/ChargeTotalAmount`                        | Falls back to summed charges when absent.                                              |
| `totals.taxExclusive`         | BT-109      | `LegalMonetaryTotal/TaxExclusiveAmount`                       |                                                                                        |
| `totals.taxTotal`             | BT-110      | `TaxTotal/TaxAmount`                                          | Falls back to the sum of `TaxSubtotal/TaxAmount` rows.                                 |
| `totals.taxInclusive`         | BT-112      | `LegalMonetaryTotal/TaxInclusiveAmount`                       |                                                                                        |
| `totals.paidAmount`           | BT-113      | `LegalMonetaryTotal/PrepaidAmount`                            | Defaults to `0`.                                                                       |
| `totals.roundingAmount`       | BT-114      | `LegalMonetaryTotal/PayableRoundingAmount`                    | Defaults to `0`.                                                                       |
| `totals.amountDue`            | BT-115      | `LegalMonetaryTotal/PayableAmount`                            |                                                                                        |

### 1.6 Payment

| PaymentMeans field | EN 16931 BT | UBL XPath                                                                 | Notes                                   |
| ------------------ | ----------- | ------------------------------------------------------------------------- | --------------------------------------- |
| `typeCode`         | BT-81       | `PaymentMeans/PaymentMeansCode`                                           | UNCL 4461.                              |
| `iban`             | BT-84       | `PaymentMeans/PayeeFinancialAccount/ID`                                   |                                         |
| `bic`              | BT-86       | `PaymentMeans/PayeeFinancialAccount/FinancialInstitutionBranch/ID`        |                                         |
| `accountHolder`    | BT-85       | `PaymentMeans/PayeeFinancialAccount/Name`                                 |                                         |
| `mandateReference` | BT-89       | `PaymentMeans/PaymentMandate/ID`                                          | SEPA direct-debit mandate, when present.|
| `paymentTermsNote` | BT-20       | `PaymentTerms/Note`                                                       | Joined with newlines across occurrences.|

---

## 2. CII → `Invoice`

Root element is `<rsm:CrossIndustryInvoice>`. The parser strips the
`rsm:` / `ram:` / `udt:` prefixes; the XPaths below are therefore
shown without them.

### 2.1 Document-level fields

| Invoice field             | EN 16931 BT | CII XPath                                                                                                  | Notes                                                            |
| ------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `number`                  | BT-1        | `/CrossIndustryInvoice/ExchangedDocument/ID`                                                               | Required.                                                        |
| `typeCode`                | BT-3        | `/CrossIndustryInvoice/ExchangedDocument/TypeCode`                                                         | Defaults to `380`.                                               |
| `issueDate`               | BT-2        | `/CrossIndustryInvoice/ExchangedDocument/IssueDateTime/DateTimeString` (+`@format`)                        | `format="102"` (CCYYMMDD) normalised to ISO. `format="610"` widens to day 01 with a warning. |
| `dueDate`                 | BT-9        | `…/ApplicableHeaderTradeSettlement/SpecifiedTradePaymentTerms/DueDateDateTime/DateTimeString`              |                                                                  |
| `taxPointDate`            | BT-7        | `…/ApplicableHeaderTradeSettlement/ApplicableTradeTax/TaxPointDate/DateString`                             |                                                                  |
| `currency`                | BT-5        | `…/ApplicableHeaderTradeSettlement/InvoiceCurrencyCode`                                                    | Required.                                                        |
| `taxCurrency`             | BT-6        | `…/ApplicableHeaderTradeSettlement/TaxCurrencyCode`                                                        |                                                                  |
| `buyerReference`          | BT-10       | `…/ApplicableHeaderTradeAgreement/BuyerReference`                                                          | Leitweg-ID for DE public-sector.                                 |
| `purchaseOrderReference`  | BT-13       | `…/ApplicableHeaderTradeAgreement/BuyerOrderReferencedDocument/IssuerAssignedID`                           |                                                                  |
| `contractReference`       | BT-12       | `…/ApplicableHeaderTradeAgreement/ContractReferencedDocument/IssuerAssignedID`                             |                                                                  |
| `projectReference`        | BT-11       | `…/ApplicableHeaderTradeAgreement/SpecifiedProcuringProject/ID`                                            |                                                                  |
| `notes`                   | BT-22       | `/CrossIndustryInvoice/ExchangedDocument/IncludedNote/Content`                                             |                                                                  |
| `customizationId`         | BT-24       | `/CrossIndustryInvoice/ExchangedDocumentContext/GuidelineSpecifiedDocumentContextParameter/ID`             | Used for version detection.                                      |
| `profileId`               | BT-23       | `/CrossIndustryInvoice/ExchangedDocumentContext/BusinessProcessSpecifiedDocumentContextParameter/ID`       |                                                                  |
| `sourceSyntax`            | —           | constant `'CII'`                                                                                           |                                                                  |

### 2.2 Parties

`seller` = `<SellerTradeParty>`, `buyer` = `<BuyerTradeParty>`, both
under `<ApplicableHeaderTradeAgreement>`. `payee` = `<PayeeTradeParty>`
under `<ApplicableHeaderTradeSettlement>`.

| Party field                | EN 16931 BT     | CII XPath (relative to the `*TradeParty`)                                  | Notes                                                                      |
| -------------------------- | --------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `name`                     | BT-27 / BT-44   | `Name`                                                                     | Falls back to `SpecifiedLegalOrganization/TradingBusinessName`.            |
| `vatId`                    | BT-31 / BT-48   | `SpecifiedTaxRegistration/ID` with `@schemeID="VA"`                        |                                                                            |
| `taxId`                    | BT-32 / BT-49   | `SpecifiedTaxRegistration/ID` with `@schemeID="FC"`                        |                                                                            |
| `address.street`           | BT-35 / BT-50   | `PostalTradeAddress/LineOne`                                               |                                                                            |
| `address.additionalStreet` | BT-36 / BT-51   | `PostalTradeAddress/LineTwo`                                               |                                                                            |
| `address.city`             | BT-37 / BT-52   | `PostalTradeAddress/CityName`                                              |                                                                            |
| `address.postalCode`       | BT-38 / BT-53   | `PostalTradeAddress/PostcodeCode`                                          |                                                                            |
| `address.countryCode`      | BT-40 / BT-55   | `PostalTradeAddress/CountryID`                                             | ISO 3166-1 alpha-2; defaults to `"XX"`.                                    |
| `contact.name`             | BT-41 / BT-56   | `DefinedTradeContact/PersonName`                                           | Falls back to `DefinedTradeContact/DepartmentName`.                        |
| `contact.email`            | BT-43 / BT-58   | `DefinedTradeContact/EmailURIUniversalCommunication/URIID`                 |                                                                            |
| `contact.phone`            | BT-42 / BT-57   | `DefinedTradeContact/TelephoneUniversalCommunication/CompleteNumber`       |                                                                            |
| `electronicAddress.scheme` | BT-34 / BT-49   | `URIUniversalCommunication/URIID/@schemeID`                                | Defaults to `"EM"`.                                                        |
| `electronicAddress.value`  | BT-34 / BT-49   | `URIUniversalCommunication/URIID` (text)                                   |                                                                            |

### 2.3 Lines

Each `<IncludedSupplyChainTradeLineItem>` becomes one entry.

| LineItem field   | EN 16931 BT | CII XPath (relative to the line node)                                                           | Notes                                                       |
| ---------------- | ----------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `id`             | BT-126      | `AssociatedDocumentLineDocument/LineID`                                                         | Falls back to the 1-based index.                            |
| `note`           | BT-127      | `AssociatedDocumentLineDocument/IncludedNote/Content`                                           |                                                             |
| `name`           | BT-153      | `SpecifiedTradeProduct/Name`                                                                    |                                                             |
| `description`    | BT-154      | `SpecifiedTradeProduct/Description`                                                             |                                                             |
| `sellerItemId`   | BT-155      | `SpecifiedTradeProduct/SellerAssignedID`                                                        |                                                             |
| `buyerItemId`    | BT-156      | `SpecifiedTradeProduct/BuyerAssignedID`                                                         |                                                             |
| `standardItemId` | BT-157      | `SpecifiedTradeProduct/GlobalID`                                                                |                                                             |
| `quantity`       | BT-129      | `SpecifiedLineTradeDelivery/BilledQuantity`                                                     |                                                             |
| `unitCode`       | BT-130      | `SpecifiedLineTradeDelivery/BilledQuantity/@unitCode`                                           | Defaults to `C62`.                                          |
| `unitPrice`      | BT-146      | `SpecifiedLineTradeAgreement/NetPriceProductTradePrice/ChargeAmount`                            | Falls back to `GrossPriceProductTradePrice/ChargeAmount`.   |
| `netAmount`      | BT-131      | `SpecifiedLineTradeSettlement/SpecifiedTradeSettlementLineMonetarySummation/LineTotalAmount`    |                                                             |
| `taxCategory`    | BT-151/152  | `SpecifiedLineTradeSettlement/ApplicableTradeTax` (`CategoryCode`, `RateApplicablePercent`)     | UNCL 5305 category code.                                    |

### 2.4 Document-level allowances / charges

Iterates over `<ApplicableHeaderTradeSettlement>/SpecifiedTradeAllowanceCharge`.

| AllowanceCharge field | EN 16931 BT | CII XPath                                     | Notes                                                                         |
| --------------------- | ----------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| `isCharge`            | BT-94/99    | `ChargeIndicator` or `ChargeIndicator/Indicator` | CII allows either a flat text or a wrapped `<Indicator>` child.            |
| `amount`              | BT-92/99    | `ActualAmount`                                |                                                                               |
| `baseAmount`          | BT-93/100   | `BasisAmount`                                 |                                                                               |
| `percentage`          | BT-94/101   | `CalculationPercent`                          |                                                                               |
| `reason`              | BT-97/104   | `Reason`                                      |                                                                               |
| `reasonCode`          | BT-98/105   | `ReasonCode`                                  |                                                                               |
| `taxCategory`         | BT-95/102   | `CategoryTradeTax` (`CategoryCode`, `RateApplicablePercent`) |                                                                |

### 2.5 Tax breakdown and totals

All under `<ApplicableHeaderTradeSettlement>`.

| Invoice field                   | EN 16931 BT | CII XPath                                                                         | Notes                                                                        |
| ------------------------------- | ----------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `taxBreakdown[].category`       | BT-118      | `ApplicableTradeTax` (`CategoryCode`, `RateApplicablePercent`, `ExemptionReason`) | One row per `ApplicableTradeTax` group at the header.                        |
| `taxBreakdown[].taxableAmount`  | BT-116      | `ApplicableTradeTax/BasisAmount`                                                  |                                                                              |
| `taxBreakdown[].taxAmount`      | BT-117      | `ApplicableTradeTax/CalculatedAmount`                                             |                                                                              |
| `totals.lineNetTotal`           | BT-106      | `SpecifiedTradeSettlementHeaderMonetarySummation/LineTotalAmount`                 |                                                                              |
| `totals.allowanceTotal`         | BT-107      | `…/AllowanceTotalAmount`                                                          | Falls back to summed allowances when absent.                                 |
| `totals.chargeTotal`            | BT-108      | `…/ChargeTotalAmount`                                                             | Falls back to summed charges when absent.                                    |
| `totals.taxExclusive`           | BT-109      | `…/TaxBasisTotalAmount`                                                           |                                                                              |
| `totals.taxTotal`               | BT-110      | `…/TaxTotalAmount`                                                                | Falls back to the sum of breakdown `CalculatedAmount` rows.                  |
| `totals.taxInclusive`           | BT-112      | `…/GrandTotalAmount`                                                              |                                                                              |
| `totals.paidAmount`             | BT-113      | `…/TotalPrepaidAmount`                                                            | Defaults to `0`.                                                             |
| `totals.roundingAmount`         | BT-114      | `…/RoundingAmount`                                                                | Defaults to `0`.                                                             |
| `totals.amountDue`              | BT-115      | `…/DuePayableAmount`                                                              |                                                                              |

### 2.6 Payment

| PaymentMeans field | EN 16931 BT | CII XPath (relative to `SpecifiedTradeSettlementPaymentMeans`)                      | Notes                                                |
| ------------------ | ----------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `typeCode`         | BT-81       | `TypeCode`                                                                          | UNCL 4461.                                           |
| `iban`             | BT-84       | `PayeePartyCreditorFinancialAccount/IBANID`                                         | Falls back to `ProprietaryID`.                       |
| `bic`              | BT-86       | `PayeeSpecifiedCreditorFinancialInstitution/BICID`                                  |                                                      |
| `accountHolder`    | BT-85       | `PayeePartyCreditorFinancialAccount/AccountName`                                    |                                                      |
| `mandateReference` | BT-89       | `PayerPartyDebtorFinancialAccount/ProprietaryID`                                    | SEPA direct-debit mandate.                           |
| `paymentTermsNote` | BT-20       | `…/ApplicableHeaderTradeSettlement/SpecifiedTradePaymentTerms/Description`          | Joined with newlines across occurrences.             |

---

## 3. Version detection

Both parsers inspect the customisation URN
(`cbc:CustomizationID` or `ram:GuidelineSpecifiedDocumentContextParameter/ram:ID`)
and emit warnings accordingly:

| Condition                                       | Result                                            |
| ----------------------------------------------- | ------------------------------------------------- |
| URN contains `xrechnung_3.0`                    | No warning.                                       |
| URN contains `xrechnung_2`                      | `{ kind: 'deprecated-version' }` warning emitted. |
| URN contains `en16931` but no xrechnung marker  | `{ kind: 'unrecognised-version' }` warning.       |

The invoice is still returned in all three cases — the warnings surface
via `result.warnings` for the UI to render.
