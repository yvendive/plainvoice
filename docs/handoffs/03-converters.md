# Hand-off 03 — M3: Converters (CSV, TXT, XLSX) + drop-zone wiring

**Owner:** Claude Code
**Model recommendation:** Opus 4.7 (UI wiring + three converters + new i18n strings is a wide surface; the extra care is worth it)
**Branch:** `m3-converters`
**Target PR title:** `M3: CSV + TXT + XLSX converters and drop-zone wiring`
**Depends on:** M2 merged to `main` (parsers + `Invoice` schema available via `@/lib/invoice`)

---

## 1. Objective

Turn the `Invoice` model produced by the M2 parsers into three downloadable outputs — **CSV**, **TXT**, **XLSX** — and wire the landing page's drop zone to the full parse → confirm → convert → download flow. PDF is **out of scope** for this milestone and will land in M4.

When M3 ships, a user dropping a valid X-Rechnung XML can:
1. See a confirmation card with the key fields so they know they picked the right file.
2. Choose CSV, TXT, or XLSX (PDF visible but disabled with a "bald verfügbar" tag).
3. Click **Konvertieren** / **Convert** and download a file named `{InvoiceNumber}.{ext}`.

Nothing leaves the browser. All generation runs client-side.

---

## 2. Scope

**In:**
- `src/lib/convert/csv.ts` — both layouts (line-items default, header-only).
- `src/lib/convert/txt.ts` — human-readable aligned report.
- `src/lib/convert/xlsx.ts` — three sheets via ExcelJS.
- Shared helpers: filename sanitiser, number/date localisation.
- Replace the M1 placeholder toast in `FileDropZone` with real pipeline.
- New `ConfirmationCard`, `FormatPicker`, `CsvOptions`, `ResultPanel` components.
- New i18n strings in `src/i18n/messages/de.json` and `en.json`.
- Vitest suite covering each converter against all 5 fixtures, plus a snapshot-style TXT test.

**Out (deferred):**
- PDF generation (M4, separate lift — fonts, layout, branding).
- Dark mode.
- "Offizielle KoSIT-Ansicht" toggle (v1.1).
- Plausible / Sentry integration (M5).

---

## 3. Converter contract

All converters expose the same async signature so the UI is format-agnostic:

```ts
// src/lib/convert/types.ts
import type { Invoice } from '@/lib/invoice';

export type Locale = 'de' | 'en';

export interface ConverterResult {
  blob: Blob;
  filename: string;   // already sanitised, e.g. "INV-2026-0001.csv"
  mimeType: string;   // e.g. "text/csv;charset=utf-8"
}

export interface BaseOptions {
  locale: Locale;
}

export interface CsvOptions extends BaseOptions {
  layout: 'line-items' | 'header-only';
  separator: ';' | ',' | '\t';    // default ';'
  decimal: ',' | '.';              // default ','  (DE convention)
}

export interface TxtOptions extends BaseOptions {}

export interface XlsxOptions extends BaseOptions {}

export type Converter<O extends BaseOptions> =
  (invoice: Invoice, options: O) => Promise<ConverterResult>;
```

All three converters **must never throw** for a schema-valid `Invoice`. Localise errors at the boundary (we don't want a crashed browser tab).

### 3.1 Filename helper

```ts
// src/lib/convert/filename.ts
export function invoiceFilename(invoice: Invoice, ext: 'csv' | 'txt' | 'xlsx' | 'pdf'): string {
  // Strip anything that isn't a safe filename char; collapse runs of whitespace/underscore.
  // Fallback: "rechnung" (locale='de') / "invoice" (locale='en') — caller decides fallback label.
  // Truncate at 80 chars before adding the extension.
}
```

- Sanitise: keep `[A-Za-z0-9._-]`, replace everything else with `_`, collapse duplicates, trim leading/trailing `_`.
- If the sanitised base is empty, use a fallback of the caller's choice (wire the UI to pass `t('fallbackFilename')`).

---

## 4. Format details

### 4.1 CSV (`src/lib/convert/csv.ts`)

**Encoding:** UTF-8 **with BOM** (`\uFEFF` prefix) — so Excel on Windows recognises it as UTF-8 without the user having to mess with locale settings.

**Quoting:** RFC 4180. Wrap a field in double quotes if it contains the separator, a double quote, a CR, or a LF. Escape internal `"` as `""`.

**Line endings:** `\r\n`.

**Layouts:**

**Layout A — `line-items` (default).** One row per invoice line. Columns:

| # | Column (EN key)            | DE header                  | Source                                            |
|---|----------------------------|----------------------------|---------------------------------------------------|
| 1 | `invoiceNumber`            | Rechnungsnummer            | `invoice.number`                                  |
| 2 | `issueDate`                | Rechnungsdatum             | `invoice.issueDate`                               |
| 3 | `dueDate`                  | Fälligkeitsdatum           | `invoice.dueDate`                                 |
| 4 | `sellerName`               | Verkäufer                  | `invoice.seller.name`                             |
| 5 | `sellerVatId`              | USt-IdNr. Verkäufer        | `invoice.seller.vatId`                            |
| 6 | `buyerName`                | Käufer                     | `invoice.buyer.name`                              |
| 7 | `buyerReference`           | Leitweg-ID / Buyer-Ref     | `invoice.buyerReference`                          |
| 8 | `lineId`                   | Pos.                       | `line.id`                                         |
| 9 | `itemName`                 | Artikel                    | `line.name`                                       |
|10 | `itemDescription`          | Beschreibung               | `line.description`                                |
|11 | `quantity`                 | Menge                      | `line.quantity` (localised decimal)               |
|12 | `unitCode`                 | Einheit                    | `line.unitCode`                                   |
|13 | `unitPrice`                | Einzelpreis                | `line.unitPrice` (localised)                      |
|14 | `lineNetAmount`            | Netto                      | `line.netAmount` (localised)                      |
|15 | `taxCategory`              | USt-Kategorie              | `line.taxCategory.code`                           |
|16 | `taxRate`                  | USt-Satz %                 | `line.taxCategory.rate`                           |
|17 | `currency`                 | Währung                    | `invoice.currency`                                |
|18 | `grandTotal`               | Gesamtsumme                | `invoice.totals.taxInclusive` (repeated per row)  |
|19 | `amountDue`                | Zahlbetrag                 | `invoice.totals.amountDue` (repeated)             |

**Layout B — `header-only`.** One row, header-level only. Columns 1–7, then `lineCount`, `lineNetTotal`, `taxTotal`, `currency`, `grandTotal`, `amountDue`, `iban`, `bic`, `paymentTermsNote`.

**Numbers:** format according to `options.decimal`. No thousands separator (keep CSVs import-friendly for DATEV and similar — they parse raw decimals). Amounts rendered with 2 decimal places; quantities with up to 3 trailing zeros trimmed.

**Dates:** ISO `YYYY-MM-DD` regardless of locale. Date formatting is a display concern and CSVs are for import.

**MIME:** `text/csv;charset=utf-8`.

### 4.2 TXT (`src/lib/convert/txt.ts`)

**Encoding:** UTF-8.
**Line endings:** `\r\n` (Windows-friendly; modern macOS/Linux tools handle this fine).
**MIME:** `text/plain;charset=utf-8`.

**Structure** (use visible separators — `═` and `─` box-drawing chars render in Notepad, TextEdit, terminals):

```
╔══════════════════════════════════════════════════════════════╗
║  Rechnung                                                    ║
╠══════════════════════════════════════════════════════════════╣
  Rechnungsnummer    : INV-2026-0001
  Rechnungsdatum     : 2026-04-22
  Fälligkeit         : 2026-05-22
  Format             : UBL 2.1
  Leitweg-ID         : 04011000-12345-67

  Verkäufer
    Muster Dienstleister GmbH
    Musterstraße 12
    10115 Berlin, DE
    USt-IdNr.: DE123456789

  Käufer
    Beispiel Behörde
    Behördenweg 2
    80331 München, DE

  ── Positionen ─────────────────────────────────────────────
  Pos.  Artikel                    Menge    Einzelp.      Netto
  ──────────────────────────────────────────────────────────
  1     Beratungsleistung          4 HUR    50,00 €      200,00 €
  ──────────────────────────────────────────────────────────

  ── Steuer ─────────────────────────────────────────────────
  S  19,00 %    Basis  200,00 €    Steuer   38,00 €
  ──────────────────────────────────────────────────────────

  ── Summen ─────────────────────────────────────────────────
  Netto                                        200,00 €
  Umsatzsteuer                                  38,00 €
  Brutto                                       238,00 €
  Zahlbetrag                                   238,00 €

  Zahlungsbedingungen:
    Zahlbar innerhalb von 30 Tagen netto ohne Abzug.
    IBAN: DE89370400440532013000
    BIC:  COBADEFFXXX

  Notes:
    Vielen Dank für Ihren Auftrag.
```

- **Column widths:** use a fixed-width table renderer. Left-align labels (20 chars), right-align money. Truncate long item names with `…`.
- **Numbers:** localised (DE: `1.234,56 €`, EN: `€ 1,234.56`). Keep currency symbol attached.
- **Dates:** ISO in the TXT (`YYYY-MM-DD`). We keep it unambiguous; TXT is a reference artefact, not a display artefact.
- **Empty sections** (no notes, no payment terms) are omitted, not left as empty blocks.

### 4.3 XLSX (`src/lib/convert/xlsx.ts`)

**Library:** [`exceljs`](https://github.com/exceljs/exceljs) (MIT, browser-compatible).
**MIME:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

**Workbook contains three sheets:**

**Sheet 1 — `Übersicht` (DE) / `Overview` (EN):**
- Two-column layout: `Feld` / `Wert` (or `Field` / `Value`).
- Rows: Rechnungsnummer, Rechnungsdatum, Fälligkeit, Format (UBL/CII), Währung, Leitweg-ID, Verkäufer (name + VAT + address concatenated across a few rows), Käufer, Zahlungsbedingungen, IBAN, BIC, Nettosumme, Umsatzsteuer, Bruttosumme, Zahlbetrag.
- Bold first column. Auto-width.

**Sheet 2 — `Positionen` (DE) / `Line items` (EN):**
- Same columns as the CSV line-items layout's line-level fields (columns 8–17 of §4.1), plus `Zeilen-Gesamtbetrag`.
- Frozen header row (row 1).
- Currency columns formatted as `#,##0.00 "€"` (DE) or `"€" #,##0.00` (EN).
- Number columns formatted as `#,##0.###`.

**Sheet 3 — `Steuer` (DE) / `Tax breakdown` (EN):**
- Columns: `Kategorie`, `Satz %`, `Basis`, `Steuer`.
- Frozen header row.
- Currency format on Basis / Steuer.

**Column widths:** auto-size per column (iterate rows, pick the max string length, clamp to `[10, 50]`, multiply by `1.2`). ExcelJS doesn't auto-size natively — write the helper.

**Accepted display:** on open in MS Excel 2019+, LibreOffice Calc, and Numbers, all three sheets render with sensible widths, currency cells formatted, header row frozen.

---

## 5. UI wiring

### 5.1 State machine

The landing page moves through three visual states. A single `use-reducer` hook (or co-located `useState` trio) in `src/app/[locale]/page.tsx` or a new `src/components/Converter.tsx`:

```
idle ──(drop file)──► parsing ──(ok)──────► ready ──(click Convert)──► generating ──► done ──► (reset) ──► idle
                              │
                              └──(error)──► invalid ──(reset)──► idle
```

- **idle** — current M1 drop zone, minus the "coming soon" toast.
- **parsing** — show a small spinner inline where the drop zone was; parse is near-instant but we still show the state because XLSX might take 200–400 ms later.
- **ready** — replace drop zone with `ConfirmationCard` + `FormatPicker` + `Konvertieren` button.
- **invalid** — replace drop zone with `ErrorCard` listing the `ParseError` kind in human language; "Andere Datei wählen" resets to idle.
- **generating / done / reset** — after clicking Convert, trigger the download and switch to a compact "Fertig — noch eine Datei konvertieren?" row.

### 5.2 New components

- `src/components/ConfirmationCard.tsx` — shows filename, detected syntax (UBL/CII), invoice number, issue date, seller name, buyer name, currency + grand total. Icons and compact spacing.
- `src/components/FormatPicker.tsx` — radio group for PDF/XLSX/CSV/TXT. PDF is present but `disabled`, rendered with a `Bald verfügbar` badge. Default selection is XLSX in M3 (PDF would be default once it lands; override with a `defaultFormat` prop so M4 only needs to flip the default).
- `src/components/CsvOptions.tsx` — shown only when CSV is selected. Collapsible "Optionen" disclosure containing: layout radio (line-items default / header-only), separator radio (`;` default / `,` / `tab`), decimal radio (`,` default / `.`). Store in local state; plumb into the converter.
- `src/components/ErrorCard.tsx` — localised message per `ParseError.kind`.
- `src/components/ResultPanel.tsx` — "Fertig" state with filename, file-size, and a "Convert another file" reset link.

### 5.3 Replacing `FileDropZone` wiring

In `handleFiles`, replace the placeholder toast with:

```ts
const text = await file.text();
const result = parseInvoice(text);
if (result.ok) onParsed(result.invoice, file.name, result.warnings);
else onParseFailed(result.error, file.name);
```

Keep the 10-MB client-side size check. Keep the `.xml` extension hint but don't hard-gate on extension — some users rename.

### 5.4 Triggering the download

```ts
async function handleConvert() {
  const result = await activeConverter(invoice, options);
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

Don't open new tabs. Don't navigate. Revoke the object URL after the click.

---

## 6. Localisation

Add keys to both `de.json` and `en.json`. **The DE strings are canonical** for the product; EN is a direct translation. Ask back in the PR description if any DE phrasing feels off.

### 6.1 New `Converter` keys

```
Converter.parsing              "Datei wird gelesen …" / "Reading file…"
Converter.confirmTitle         "Datei erkannt" / "File detected"
Converter.confirmFilename      "Dateiname" / "Filename"
Converter.confirmSyntax        "Format" / "Format"
Converter.confirmNumber        "Rechnungsnummer" / "Invoice number"
Converter.confirmIssueDate     "Rechnungsdatum" / "Invoice date"
Converter.confirmSeller        "Verkäufer" / "Seller"
Converter.confirmBuyer         "Käufer" / "Buyer"
Converter.confirmTotal         "Gesamtbetrag" / "Grand total"
Converter.selectFormat         "Ausgabeformat wählen" / "Choose output format"
Converter.formatPdf            "PDF"
Converter.formatXlsx           "Excel (XLSX)"
Converter.formatCsv            "CSV"
Converter.formatTxt            "Text (TXT)"
Converter.comingSoonBadge      "Bald verfügbar" / "Coming soon"
Converter.csvOptions           "CSV-Optionen" / "CSV options"
Converter.csvLayout            "Layout" / "Layout"
Converter.csvLayoutLines       "Eine Zeile pro Position" / "One row per line item"
Converter.csvLayoutHeader      "Eine Zeile pro Rechnung" / "One row per invoice"
Converter.csvSeparator         "Trennzeichen" / "Separator"
Converter.csvDecimal           "Dezimalzeichen" / "Decimal separator"
Converter.convertButton        "Konvertieren" / "Convert"
Converter.convertAnother       "Weitere Datei konvertieren" / "Convert another file"
Converter.readyTitle           "Fertig" / "Done"
Converter.errorTitle           "Diese Datei konnte nicht gelesen werden" / "Couldn't read this file"
Converter.errorNotXml          "Die Datei ist keine gültige XML-Datei." / "The file isn't valid XML."
Converter.errorNotXrechnung    "Die Datei scheint keine X-Rechnung zu sein." / "This doesn't look like an X-Rechnung."
Converter.errorMissing         "Pflichtfeld fehlt: {field}" / "Required field missing: {field}"
Converter.errorTooBig          "Die Datei ist größer als 10 MB." / "The file is larger than 10 MB."
Converter.fallbackFilename     "rechnung" / "invoice"
Converter.warningVersion       "Hinweis: ältere XRechnung-Version erkannt." / "Notice: older XRechnung version detected."
```

### 6.2 Converter-output headers

TXT section labels and XLSX/CSV column headers must pick up from the same `Converter.columns.*` / `Converter.sections.*` keys — keep them in one place so QA touches one file.

---

## 7. Fixtures & test plan

### 7.1 Fixtures

Use the five fixtures from M2 (`samples/ubl-invoice-standard.xml`, `cii-invoice-standard.xml`, `ubl-credit-note.xml`, `cii-mixed-rate.xml`, `ubl-reverse-charge.xml`). Don't add more unless a format needs a specific edge (e.g. fixture with three allowances for XLSX column sanity).

### 7.2 Tests

Target **≥85% line coverage** on `src/lib/convert/`. Vitest suite organised as:

- `tests/convert/csv.test.ts`
  - Line-items layout: row count = line count; header matches locale; BOM present; fields quoted correctly (test with a line item whose name contains `;` and `"`); decimal separator switches with option.
  - Header-only layout: single data row; all header-level amounts present.
  - Works for all five fixtures without throwing.
- `tests/convert/txt.test.ts`
  - Snapshot test per fixture (`expect(output).toMatchSnapshot()`).
  - Line endings are `\r\n` (assert on raw string).
  - Contains localised labels in the active locale.
- `tests/convert/xlsx.test.ts`
  - Round-trip: read the generated Blob back with ExcelJS → assert three sheets exist with expected names (per locale) → assert row counts match invoice shape.
  - Frozen first row on sheets 2 and 3.
  - Currency cell format string contains `€`.
- `tests/convert/filename.test.ts`
  - Sanitises special chars, collapses runs, truncates to 80, falls back to caller's fallback.
- `tests/convert/integration.test.ts`
  - End-to-end for each fixture: `parseInvoice(xml)` → `convertFoo(invoice)` → assert `ConverterResult` shape.

### 7.3 Manual QA checklist (include in PR description)

- [ ] Open each generated CSV in Excel, DATEV-compatible import — no character corruption.
- [ ] Open each generated XLSX in MS Excel, LibreOffice Calc, Numbers — all three sheets render; currency formatted.
- [ ] Open each generated TXT in Notepad (Windows) and TextEdit (macOS) — box-drawing chars render; umlauts correct.
- [ ] Drop a non-XML file → error card shows correct message.
- [ ] Drop an XML that isn't an X-Rechnung → error card shows correct message.
- [ ] DE/EN toggle updates confirmation card + TXT section labels on next conversion.

---

## 8. Architecture decisions locked

- **Client-side only.** No server calls during conversion. Don't add `'use server'`, don't reach for route handlers.
- **ExcelJS over SheetJS.** MIT-licensed, XLSX-native, maintained, reasonable bundle size. Don't swap without discussing.
- **No streaming.** Single-file invoices are tiny; generate into memory, hand a Blob to the UI.
- **Localised headers everywhere.** CSV, XLSX, TXT all respect the active locale — never the XML's language.
- **Numbers use dots inside the data model, locale at the boundary.** The `Invoice` model stores numbers as JS `number` (already ensured by M2). Formatting is a converter concern — don't retain locale-dependent strings in the model.

---

## 9. Sharp edges / gotchas

1. **Excel + BOM.** Without the BOM, Excel on Windows treats the CSV as ANSI and mangles umlauts. With the BOM, some older tools barf. We ship the BOM and document the trade-off in the spec footnote.
2. **German decimal comma + `;` separator.** The whole reason we default to `;` — comma would collide with the decimal. If the user picks `,` as separator, also switch default decimal to `.` (but let them override both independently).
3. **CSV quoting of newlines inside notes.** Payment-terms notes can contain `\n`. Quote the whole field and keep the newline; Excel handles it. Don't collapse to space.
4. **ExcelJS bundle size.** It's ~200 KB gzipped. Import dynamically (`await import('exceljs')`) inside the XLSX converter so the initial chunk stays small.
5. **Filename collisions.** If two fixtures share an invoice number during batch testing (they don't today, but…), the sanitiser doesn't dedupe. That's the caller's job — OK for M3 since we're single-file.
6. **Credit notes.** `invoice.typeCode === '381'`. TXT should say "Gutschrift" / "Credit note" in the header, not "Rechnung". Same for the XLSX title cell.
7. **Reverse charge.** `taxCategory.code === 'AE'` means no VAT collected. TXT tax section should include the exemption reason. CSV `taxRate` column is `0.00` — don't hide the row.
8. **Mixed rates.** The tax-breakdown section gets multiple rows. Hard-code nothing about "19%"; iterate `invoice.taxBreakdown`.
9. **Number formatting rounding.** Use `Intl.NumberFormat` with `minimumFractionDigits: 2, maximumFractionDigits: 2` for money. Don't hand-roll.
10. **No `dayjs` / `date-fns`.** We only render ISO dates or locale-formatted short dates via `Intl.DateTimeFormat`. Don't pull a date library for M3.

---

## 10. Dependencies to add

- `exceljs` (runtime) — XLSX generation.
- No other new runtime deps.
- No new dev deps unless you need a type shim that ExcelJS doesn't ship (it does).

Remember `packageManager: "pnpm@10.33.1"` is the single source of truth — just `pnpm add exceljs`.

---

## 11. Definition of Done

- [ ] All three converters implemented with the contract from §3.
- [ ] `FileDropZone` wired through the full state machine; no placeholder toast remaining.
- [ ] New components (`ConfirmationCard`, `FormatPicker`, `CsvOptions`, `ErrorCard`, `ResultPanel`) exist and use existing `src/components/ui/` primitives.
- [ ] DE + EN i18n keys added; both locales render without `Missing message` warnings.
- [ ] Vitest suite green; coverage ≥85% on `src/lib/convert/`.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass.
- [ ] CI green on the PR.
- [ ] `PROGRESS.md` has a new `## 2026-MM-DD — M3 converters + drop-zone wiring` section with **Done / Next** lists, same style as the M2 entry.
- [ ] PR description includes the §7.3 manual-QA checklist and short screenshots of the new UI states.

---

## 12. What happens after M3

Cowork writes `docs/handoffs/04-pdf.md` — PDF generation via `pdf-lib` + `@pdf-lib/fontkit` with embedded Inter/Noto Sans, branded layout, A4, DE/EN. That's a bigger lift than any single M3 converter, which is why it's its own milestone.
