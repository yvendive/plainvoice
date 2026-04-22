# Handoff 02 — UBL + CII parsers & the Invoice model (M2)

**To:** Claude Code
**From:** Cowork (Claude, acting as PM/PO)
**Milestone:** M2 — parse both X-Rechnung XML dialects into a single canonical `Invoice` model.
**Prereqs:** M1 merged. `docs/RESEARCH.md` §4 + §6.1, `docs/SPEC.md` §6 + §7 read.
**Recommended model:** **Opus 4.7.** UBL↔CII field-mapping has subtle decisions (unifying `cac:TaxSubtotal` with `ram:ApplicableTradeTax`, date format quirks, optional-vs-required nuance) where Opus's extra care meaningfully reduces debugging later.
**Estimated effort:** 4–8 focused hours.

> **Scope discipline:** this milestone touches *only* `src/lib/parse/`, `src/lib/model/`, `docs/MAPPING.md`, and `samples/`. **Do not** build any UI, wire the drop zone to the parser, or add any output generators — those are M3/M4. The drop zone stays a stub until M3.

---

## 1. What you're building

1. A TypeScript `Invoice` model that captures the ~30 EN 16931 business terms we need for all four output formats (CSV, TXT, XLSX, PDF).
2. A detector that looks at the root element + namespace of an X-Rechnung XML and decides whether it's UBL or CII.
3. Two parsers — one for each dialect — that each take a raw XML string and return an `Invoice` object (or a typed error).
4. A human-readable mapping document (`docs/MAPPING.md`) that shows which XML path in each dialect populates which field of `Invoice`. This is the future-you-and-future-me reference when we hit an edge case six months from now.
5. Test fixtures in `samples/` and Vitest cases that parse each one and assert known-correct values.

## 2. Dependencies to add

Add to `package.json`:

```json
"dependencies": {
  "fast-xml-parser": "^4.5.0"
}
```

`fast-xml-parser` (MIT, zero deps, ~20 kB gzipped, fully browser-compatible) is our chosen XML library — rationale in `docs/RESEARCH.md` §6.1. Do **not** use `xmldom`, `sax`, or the browser's `DOMParser` — `fast-xml-parser` gives us plain JS objects that are far easier to normalise across the two dialects and are trivial to unit-test.

No other new runtime deps for this milestone. Keep `exceljs` and `pdf-lib` out — they come in M3 and M4.

## 3. The `Invoice` model

Create `src/lib/model/invoice.ts`. Aim for a single file; if it grows past ~200 lines, split into `invoice.ts`, `party.ts`, `line.ts` under `src/lib/model/`.

Use `zod` schemas as the source of truth (we already added it to deps in M1). Derive TypeScript types via `z.infer<...>`. This gives us runtime validation at the parser boundary without duplicating types.

**Shape (guidance — refine as you map real fields):**

```ts
import { z } from 'zod';

export const PartySchema = z.object({
  name: z.string(),
  vatId: z.string().optional(),          // EN 16931 BT-31 / BT-48
  taxId: z.string().optional(),          // BT-32 / BT-49 (national tax registration)
  address: z.object({
    street: z.string().optional(),
    additionalStreet: z.string().optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
    countryCode: z.string().length(2),   // ISO 3166-1 alpha-2, e.g. 'DE'
  }),
  contact: z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
  electronicAddress: z.object({          // BT-34 / BT-49 (Peppol / email identifier)
    scheme: z.string(),                  // e.g. 'EM' for email, '0088' for EAN
    value: z.string(),
  }).optional(),
});
export type Party = z.infer<typeof PartySchema>;

export const TaxCategorySchema = z.object({
  code: z.string(),                      // 'S', 'Z', 'E', 'AE', 'K', 'G', 'O', 'L', 'M' per UNCL 5305
  rate: z.number(),                      // percentage, e.g. 19
  exemptionReason: z.string().optional(),
});
export type TaxCategory = z.infer<typeof TaxCategorySchema>;

export const LineItemSchema = z.object({
  id: z.string(),                        // BT-126 (line ID)
  name: z.string(),                      // BT-153 item name
  description: z.string().optional(),    // BT-154
  sellerItemId: z.string().optional(),   // BT-155
  buyerItemId: z.string().optional(),    // BT-156
  standardItemId: z.string().optional(), // BT-157 (GTIN, etc.)
  quantity: z.number(),                  // BT-129
  unitCode: z.string(),                  // UNECE Rec 20, e.g. 'H87' (piece), 'HUR' (hour)
  unitPrice: z.number(),                 // BT-146
  netAmount: z.number(),                 // BT-131 (quantity × unit price, minus line-level allowances/charges)
  taxCategory: TaxCategorySchema,
  note: z.string().optional(),           // BT-127
});
export type LineItem = z.infer<typeof LineItemSchema>;

export const AllowanceChargeSchema = z.object({
  isCharge: z.boolean(),                 // true = charge (surcharge), false = allowance (discount)
  amount: z.number(),
  baseAmount: z.number().optional(),
  percentage: z.number().optional(),
  reason: z.string().optional(),
  reasonCode: z.string().optional(),
  taxCategory: TaxCategorySchema.optional(),
});
export type AllowanceCharge = z.infer<typeof AllowanceChargeSchema>;

export const TaxBreakdownRowSchema = z.object({
  category: TaxCategorySchema,
  taxableAmount: z.number(),             // BT-116
  taxAmount: z.number(),                 // BT-117
});
export type TaxBreakdownRow = z.infer<typeof TaxBreakdownRowSchema>;

export const PaymentMeansSchema = z.object({
  typeCode: z.string(),                  // UNCL 4461, e.g. '58' (SEPA credit transfer), '59' (SEPA direct debit)
  iban: z.string().optional(),
  bic: z.string().optional(),
  accountHolder: z.string().optional(),
  mandateReference: z.string().optional(),
});
export type PaymentMeans = z.infer<typeof PaymentMeansSchema>;

export const InvoiceSchema = z.object({
  // Document
  number: z.string(),                    // BT-1
  typeCode: z.string(),                  // BT-3 (380 = invoice, 381 = credit note, 384 = corrected)
  issueDate: z.string(),                 // BT-2 (ISO yyyy-MM-dd in the model — normalise on parse)
  dueDate: z.string().optional(),        // BT-9
  taxPointDate: z.string().optional(),   // BT-7
  currency: z.string().length(3),        // BT-5 (ISO 4217)
  taxCurrency: z.string().length(3).optional(), // BT-6
  buyerReference: z.string().optional(), // BT-10 (Leitweg-ID for German public-sector)
  purchaseOrderReference: z.string().optional(),
  contractReference: z.string().optional(),
  projectReference: z.string().optional(),
  notes: z.array(z.string()).default([]),// BT-22

  // Parties
  seller: PartySchema,
  buyer: PartySchema,
  payee: PartySchema.optional(),         // only if different from seller

  // Lines
  lines: z.array(LineItemSchema),

  // Document-level allowances/charges (affect the whole invoice)
  allowancesCharges: z.array(AllowanceChargeSchema).default([]),

  // Tax
  taxBreakdown: z.array(TaxBreakdownRowSchema),

  // Totals (BT-106..BT-115)
  totals: z.object({
    lineNetTotal: z.number(),            // sum of line BT-131s
    allowanceTotal: z.number(),          // document-level allowances
    chargeTotal: z.number(),             // document-level charges
    taxExclusive: z.number(),            // BT-109
    taxTotal: z.number(),                // BT-110
    taxInclusive: z.number(),            // BT-112
    paidAmount: z.number().default(0),   // BT-113
    roundingAmount: z.number().default(0),
    amountDue: z.number(),               // BT-115
  }),

  // Payment
  paymentMeans: z.array(PaymentMeansSchema).default([]),
  paymentTermsNote: z.string().optional(),

  // Provenance — helpful for the UI confirmation card and for debugging
  sourceSyntax: z.enum(['UBL', 'CII']),
  customizationId: z.string().optional(),// specification URN we detected
  profileId: z.string().optional(),      // profile URN (for CII / XRechnung extensions)
});
export type Invoice = z.infer<typeof InvoiceSchema>;
```

Tweak field names if something reads more naturally in context, but the grouping (document → parties → lines → allowances → tax → totals → payment → provenance) should stay.

## 4. Parser contract

Create:

- `src/lib/parse/detect.ts` — sniff the root element / namespace, return `'UBL' | 'CII' | 'unknown'`.
- `src/lib/parse/ubl.ts` — `export function parseUBL(xml: string): ParseResult`
- `src/lib/parse/cii.ts` — `export function parseCII(xml: string): ParseResult`
- `src/lib/parse/index.ts` — `export function parseXRechnung(xml: string): ParseResult` — runs detect + dispatches.

**No exceptions across the module boundary.** Use a discriminated union:

```ts
export type ParseResult =
  | { ok: true; invoice: Invoice; warnings: ParseWarning[] }
  | { ok: false; error: ParseError };

export type ParseError =
  | { kind: 'not-xml'; detail: string }
  | { kind: 'not-xrechnung'; detail: string }   // parseable XML but not an X-Rechnung
  | { kind: 'missing-required-field'; field: string; xpath: string }
  | { kind: 'invalid-field'; field: string; xpath: string; detail: string }
  | { kind: 'unknown-syntax'; rootElement: string; namespace?: string };

export type ParseWarning =
  | { kind: 'missing-optional-field'; field: string }
  | { kind: 'unrecognised-version'; detail: string }
  | { kind: 'deprecated-version'; detail: string }; // e.g. XRechnung 2.x
```

Rationale: the UI layer (M3) needs to render specific error UIs and warning banners. Typed errors keep that logic declarative.

**Detection rules:**
- Root `<Invoice>` or `<CreditNote>` with namespace `urn:oasis:names:specification:ubl:schema:xsd:*` → UBL.
- Root `<rsm:CrossIndustryInvoice>` with namespace `urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:*` → CII.
- Anything else → `unknown-syntax` error.

**Version handling:**
- Read `cbc:CustomizationID` (UBL) / `ram:GuidelineSpecifiedDocumentContextParameter/ram:ID` (CII).
- If the URN contains `xrechnung_3.0` → fine, no warning.
- If it contains `xrechnung_2` → emit `deprecated-version` warning, continue parsing.
- If it contains neither but still matches EN 16931 → emit `unrecognised-version` warning, continue.

## 5. Field-mapping document

Create `docs/MAPPING.md` with two sections: "UBL → Invoice" and "CII → Invoice". Each section is a table with columns: `Invoice field | EN 16931 BT | XPath | Notes`. This is a living reference — keep it accurate and grep-able. It should take ~30 minutes to produce once the parsers are written; treat it as the last step before tests.

## 6. Sample fixtures to add

Two starter fixtures are already in `samples/` (`ubl-invoice-standard.xml`, `cii-invoice-standard.xml`). Extend with at least three more to cover edge cases:

1. **`samples/ubl-credit-note.xml`** — a UBL CreditNote (root `<CreditNote>`, not `<Invoice>`; different date field names). Invoice type code `381`.
2. **`samples/cii-multi-tax.xml`** — CII invoice with at least two different VAT rates in the breakdown (e.g., 19% on one line, 7% on another).
3. **`samples/ubl-with-allowances-charges.xml`** — UBL invoice with both a line-level allowance and a document-level charge, so we exercise the `AllowanceCharge` handling.

Anonymise all party data (no real company names, no real VAT IDs, no real IBANs — use `DE89 3704 0044 0532 0130 00` which is a published test IBAN). Amounts should be realistic but simple (e.g., 100.00, 50.00, 19%).

Feel free to add more if something is easy to write and illustrative. Err on the side of more coverage — these fixtures double as regression tests.

## 7. Tests

Create `tests/parser.test.ts` (or `tests/parse/ubl.test.ts` + `tests/parse/cii.test.ts` if cleaner).

Each fixture must have a test that:

1. Reads the XML from disk (use `readFileSync` in test setup; `fast-xml-parser` works on a string).
2. Calls `parseXRechnung(xml)`.
3. Asserts `result.ok === true`.
4. Asserts specific known values: `invoice.number`, `invoice.typeCode`, `invoice.totals.amountDue`, `invoice.lines.length`, the sum of `invoice.taxBreakdown[].taxAmount` equals `invoice.totals.taxTotal` within a rounding tolerance (± 0.01).
5. For the deprecated-version fixture (if you add one), assert the warning is emitted.

Also add **negative tests** in `tests/parser.errors.test.ts`:

- Non-XML string → `error.kind === 'not-xml'`.
- Valid XML but random (e.g., an RSS feed) → `error.kind === 'not-xrechnung'` or `'unknown-syntax'`.
- UBL invoice with no `<cbc:ID>` → `error.kind === 'missing-required-field'` with `field === 'number'`.

Target: **≥ 90% line coverage on `src/lib/parse/`**. Add a coverage script to `package.json` (`"test:coverage": "vitest run --coverage"`) and a Vitest config bump to enable v8 coverage.

## 8. What to watch for (the sharp edges)

These are the gotchas the brief exists to front-load. Read before you start writing parser code, not after.

1. **Namespace prefixes vary.** A CII invoice in one system uses `rsm:` and `ram:` prefixes; in another, the same elements may use different prefixes or none. `fast-xml-parser` can normalise prefixes via `removeNSPrefix: true` — use that and match on local names, not prefixed names.
2. **Numbers are strings in XML.** `fast-xml-parser` can coerce via `parseTagValue: true`, but be defensive — parse floats yourself with a central helper (`toAmount(raw: string): number`) that handles `.` vs `,` (shouldn't happen in conformant X-Rechnung but happens in the wild) and rounds to 2 dp on output.
3. **CII dates are `CCYYMMDD` strings with a `format="102"` attribute** (`<udt:DateTimeString format="102">20260422</udt:DateTimeString>`). UBL uses ISO `yyyy-MM-dd`. Normalise both to ISO in the model. A `format="610"` in CII means `CCYYMM` — warn rather than throw if we ever see it.
4. **Currency is an attribute, not an element.** E.g. `<cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount>`. With `fast-xml-parser`'s default config, attributes land on `@_currencyID`. Prefer `attributeNamePrefix: ''` for cleanliness, but be consistent.
5. **UBL CreditNote is structurally almost-but-not-quite identical to UBL Invoice.** Key differences: root element name, `IssueDate` still exists but `InvoiceTypeCode` becomes `CreditNoteTypeCode`, and line element becomes `<CreditNoteLine>` with `<CreditedQuantity>` instead of `<InvoicedQuantity>`. Don't duplicate the parser — extract a shared core and branch on the root.
6. **Tax category codes come from UNCL 5305.** `S` (standard rate), `Z` (zero rate), `E` (exempt), `AE` (reverse charge), `K` (intra-community), `G` (export outside EU), `O` (outside scope), `L`/`M` (Canary/Ceuta specials — rare). Don't validate the code list exhaustively — just pass the raw code through.
7. **Line-level allowances/charges on UBL** live inside `<cac:InvoiceLine>/<cac:AllowanceCharge>` and affect the line's `LineExtensionAmount`. Document-level live at `<Invoice>/<cac:AllowanceCharge>` and are summed into `totals.allowanceTotal` / `totals.chargeTotal`. Keep these separate.
8. **Rounding.** Per EN 16931, the sum of line nets plus charges minus allowances plus tax should equal the grand total, but floating-point arithmetic will introduce ≤ 1 cent drift. Don't "correct" amounts — store what the XML says. Our reconciliation check should tolerate ± 0.01.
9. **Leitweg-ID** is `cbc:BuyerReference` in UBL and `ram:BuyerReference` in CII. Store in `invoice.buyerReference`. Don't validate its format (it's checksum-bearing but validation is out of scope for M2).

## 9. Definition of done

- [ ] `src/lib/model/` contains the `Invoice` + related Zod schemas and TypeScript types.
- [ ] `src/lib/parse/` contains `detect.ts`, `ubl.ts`, `cii.ts`, `index.ts` with the contract described in §4.
- [ ] `docs/MAPPING.md` exists with two full mapping tables.
- [ ] `samples/` has at least 5 fixtures (2 starters + 3 edge cases from §6).
- [ ] `tests/` has parser tests hitting every fixture + the negative cases from §7.
- [ ] `pnpm test:coverage` reports ≥ 90% line coverage on `src/lib/parse/` and `src/lib/model/`.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass.
- [ ] CI green on the PR.
- [ ] `PROGRESS.md` appended with an M2 entry.
- [ ] PR titled `M2: UBL + CII parsers and Invoice model` against `main` from a `m2-parser` branch.

## 10. Things to ask Cowork (me) before doing

- If any of the `Invoice` field names feel awkward in TypeScript, propose better ones in the PR — don't block on it.
- If you discover a field the four output formats (CSV/TXT/XLSX/PDF) will need that I didn't list, add it to `Invoice` and flag it in the PR description so I can update SPEC.md.
- If a fixture XML feels contrived, swap it for something more realistic — just keep it fully anonymised.

## 11. Explicitly out of scope

- Any UI change. The drop zone stays a visual stub.
- Wiring the drop zone to the parser. That's M3, when we also have an output format to route to.
- Output generation (CSV/TXT/XLSX/PDF) — M3/M4.
- KoSIT Schematron validation — we link out to external validators, not build one.
- PDF-input (ZUGFeRD/Factur-X) — v1.1.

The next brief (`03-converters.md`) covers CSV + TXT + XLSX generation and wiring the drop zone. I'll write that after this PR merges.
