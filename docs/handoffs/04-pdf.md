# M4 — PDF generation (branded, A4, DE/EN)

Final converter format. Replace the "Bald verfügbar / Coming soon" disabled PDF tile with a working, branded A4 invoice PDF generated entirely in the browser from the same `Invoice` model used by CSV / TXT / XLSX.

This is the largest milestone brief yet — read it end to end before starting work. Ship as Opus 4.7 recommended (layout math + typography benefits from a strong reasoner; mistakes are expensive to diff-review on a visual output).

## 1. Scope

**In scope**
- `convertPdf` converter implementing the shared `Converter<PdfOptions>` contract from `src/lib/convert/types.ts`.
- Single-file-per-invoice PDF, A4 portrait, page-numbered, paginated when line items overflow.
- DE / EN copy via the existing `labels.ts` bundle — no new i18n pipeline.
- Embedded Inter font (Regular + Bold) so the PDF renders identically across every reader (Acrobat, Preview, Okular, browser built-ins).
- Branded footer: `Erstellt mit Plainvoice · plainvoice.de` (DE) / `Generated with Plainvoice · plainvoice.de` (EN).
- Full coverage: runs correctly against every fixture in `samples/` (invoice, credit note, mixed-rate, reverse-charge — five files total).
- Wire the PDF tile in `FormatPicker` to actually generate a file, remove the `alwaysDisabled` treatment, drop the "Bald verfügbar" badge from the PDF option.

**Out of scope**
- ZUGFeRD / Factur-X embedding (XML inside PDF/A-3). Deferred to v1.1 per `docs/SPEC.md`.
- PDF/A compliance. We output plain PDF 1.7; archival conformance isn't an MVP requirement.
- Digital signatures. Not an MVP requirement.
- Custom logos or per-seller branding. The sender block uses text only (seller's legal name, address, VAT ID). Plainvoice branding is a footer credit, not a letterhead.
- Colour printing optimisation. Layout works fine on B&W; we use one accent colour for the rule above totals.
- Preview/thumbnail in the UI. User downloads the PDF, opens in their reader.

## 2. Converter contract

Extend the shared types in `src/lib/convert/types.ts`:

```ts
export interface PdfOptions extends BaseOptions {
  // No user-facing knobs in v1. Future: include QR-Rechnung payload, paper size, accent colour.
}
```

Export `PdfOptions` from `src/lib/convert/index.ts` alongside the existing types.

Implement `convertPdf: Converter<PdfOptions>` returning a `ConverterResult` whose `blob` has MIME `application/pdf` and whose `filename` is `invoiceFilename(invoice, 'pdf', options.fallbackFilename)`.

## 3. Dependencies

Add to `package.json` dependencies:

```
pdf-lib@^1.17.1
@pdf-lib/fontkit@^1.1.1
```

Both are dynamically imported inside `convertPdf` — same pattern as `exceljs` in M3. Do not import them statically at module load time or the initial page weight balloons by ~500 kB for a format the user may never pick.

## 4. File layout

```
src/lib/convert/
  pdf.ts                  # convertPdf entry — orchestrates layout, returns ConverterResult
  pdf/
    fonts.ts              # fetch + embed Inter; exported helper returns { regular, bold }
    layout.ts             # constants: page size, margins, column widths, y-cursor helpers
    draw.ts               # low-level drawing: drawText, drawRightAlignedText, drawHorizontalRule, drawTableRow
    sections/
      header.ts           # seller block + invoice metadata (top of page 1)
      parties.ts          # buyer block (and payee if present)
      lines.ts            # line-item table with pagination
      allowances.ts       # document-level allowances/charges (skip if empty)
      totals.ts           # tax breakdown + grand total + amount due
      payment.ts          # IBAN/BIC + payment terms note
      footer.ts           # page number + branding + reverse-charge disclaimer
public/fonts/
  Inter-Regular.ttf       # SIL OFL 1.1; ~310 kB
  Inter-Bold.ttf          # SIL OFL 1.1; ~320 kB
```

Add a short `public/fonts/LICENSE.txt` with the SIL OFL 1.1 notice — required by the Inter licence.

Keep section files small and pure: each takes `(page, invoice, labels, layout)` and returns the new y-cursor. No shared mutable state beyond what layout helpers expose.

## 5. Page + layout constants

A4 portrait in PDF points (1 pt = 1/72"):

- Page size: **595.28 × 841.89 pt**
- Margins: **40 pt** all four sides
- Usable width: **515.28 pt**
- Usable height: **761.89 pt**

Line-item table columns (widths in pt; must sum to usable width):

| Column        | Width | Align | Notes                                             |
|---------------|-------|-------|---------------------------------------------------|
| #             | 22    | left  | 1-based line index                                |
| Description   | 220   | left  | wraps to multiple lines if needed                 |
| Qty           | 50    | right | formatted with locale-aware thousand separator    |
| Unit          | 40    | left  | unitCode; map `HUR` → `Std.`/`h`, `XPP` → `Stk.`/`pcs`, `C62` → `Einh.`/`units`, else raw code |
| Unit price    | 70    | right | locale currency format                            |
| Tax %         | 40    | right | e.g. `19,00 %` / `19.00%`                         |
| Net           | 73.28 | right | locale currency format                            |

Typography:

- Body text: **Inter Regular, 9 pt, leading 12 pt**
- Table rows: **Inter Regular, 9 pt, leading 12 pt**
- Section labels: **Inter Bold, 9 pt**
- Party names: **Inter Bold, 10 pt**
- Invoice title ("Rechnung" / "Gutschrift" / "Invoice" / "Credit note"): **Inter Bold, 18 pt**
- Totals line (Zahlbetrag / Amount due): **Inter Bold, 11 pt**
- Footer: **Inter Regular, 8 pt, muted grey** (see colour)

Colour palette (single accent so the PDF prints cleanly):

- Body text: `rgb(0.10, 0.10, 0.12)` — near-black but not pure black (avoids ink-heavy print)
- Muted / secondary: `rgb(0.45, 0.45, 0.48)` — for footer, table header underline
- Accent rule above totals: `rgb(0.20, 0.25, 0.55)` — subdued navy, matches the app's `--accent` CSS variable in spirit

Every colour goes through a single `const COLOR = { body, muted, accent }` object in `layout.ts`. Never inline raw `rgb()` calls in section files.

## 6. Page structure (page 1)

Top → bottom, with y-cursor management:

1. **Header bar (y ~800 → 760)**
   - Top-left: seller name (Inter Bold 10 pt), then address (Inter Regular 9 pt), then VAT ID (Inter Regular 9 pt).
   - Top-right: invoice title (Inter Bold 18 pt), right-aligned. Below it, a compact metadata stack (right-aligned):
     - `Rechnungsnummer / Invoice no.: <invoice.number>`
     - `Rechnungsdatum / Issue date: <invoice.issueDate>`
     - `Fälligkeit / Due date: <invoice.dueDate>` (only if present)
     - `Leitweg-ID / Buyer reference: <invoice.buyerReference>` (only if present)

2. **Party block (y ~750 → 680)**
   - Left column (half-width): `Empfänger / Bill to` label, then buyer name, address, VAT ID.
   - Right column (half-width): only rendered if `invoice.payee` is set — `Zahlungsempfänger / Payee` label + payee block.

3. **Line-item table (y ~670 downward)**
   - Header row: column labels in muted grey (Inter Bold 9 pt), with a 0.5 pt rule directly underneath.
   - Each data row: 1–N wrapped lines for the description; all other cells render on the first line only.
   - Between rows: 2 pt vertical gap.
   - **Pagination**: when drawing the next row would push past `y = 120` (reserving space for allowances + totals + payment + footer), call `addPage()`, redraw a compact page-2+ header (invoice number + page counter), re-draw the column header, continue. See §11 for details.
   - If a line has `taxCategory.code === 'AE'`, omit the tax rate from the row — show `—` in the tax-% cell.

4. **Document-level allowances/charges (optional)**
   - Render only if `invoice.allowancesCharges.length > 0`.
   - One short table: label (e.g. "Abschlag" / "Discount"), reason (if any), amount. Align amounts right.
   - 2 pt rule below.

5. **Tax breakdown (y depends on lines)**
   - One row per `invoice.taxBreakdown` entry: `Nettobetrag <rate>%: <taxableAmount>   USt. <rate>%: <taxAmount>`.
   - Right-aligned in a narrow right-side block.

6. **Totals block (right-aligned, ~180 pt wide)**
   - `Zwischensumme netto / Net subtotal`: `invoice.totals.taxExclusive`
   - `Umsatzsteuer / VAT`: `invoice.totals.taxTotal`
   - 0.5 pt rule in accent colour
   - `Gesamtsumme / Total incl. VAT`: `invoice.totals.taxInclusive` (Inter Bold 10 pt)
   - If `paidAmount !== 0`: `Bereits gezahlt / Paid`: `-invoice.totals.paidAmount`
   - If `roundingAmount !== 0`: `Rundung / Rounding`: `invoice.totals.roundingAmount`
   - `Zahlbetrag / Amount due`: `invoice.totals.amountDue` (Inter Bold 11 pt, accent colour)

7. **Payment block (y ~120 → 80)**
   - Only rendered if `invoice.paymentMeans.length > 0` or `invoice.paymentTermsNote` is set.
   - Label `Zahlungsinformationen / Payment information` (Inter Bold 9 pt).
   - For each `paymentMeans` row with an IBAN: `IBAN: <iban>   BIC: <bic>   Kontoinhaber / Account holder: <accountHolder>`.
   - If `paymentTermsNote`: render verbatim below, wrapped to usable width.

8. **Reverse-charge disclaimer (conditional, y ~80)**
   - If any `line.taxCategory.code === 'AE'` OR any `taxBreakdown[i].category.code === 'AE'`, render:
     - DE: "Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG)."
     - EN: "Reverse charge — customer liable for VAT."
   - Inter Regular 8 pt, muted grey, full width.

9. **Footer (y = 40)**
   - Left: `Seite <n> von <N> / Page <n> of <N>`
   - Right: `Erstellt mit Plainvoice · plainvoice.de` / `Generated with Plainvoice · plainvoice.de`
   - 8 pt muted grey.

## 7. Fonts

Embed Inter Regular and Bold by loading them from `public/fonts/` at runtime:

```ts
// src/lib/convert/pdf/fonts.ts
import type { PDFDocument, PDFFont } from 'pdf-lib';

export async function embedInter(doc: PDFDocument): Promise<{ regular: PDFFont; bold: PDFFont }> {
  const fontkit = (await import('@pdf-lib/fontkit')).default;
  doc.registerFontkit(fontkit);

  const [regularBytes, boldBytes] = await Promise.all([
    fetch('/fonts/Inter-Regular.ttf').then((r) => r.arrayBuffer()),
    fetch('/fonts/Inter-Bold.ttf').then((r) => r.arrayBuffer()),
  ]);

  const [regular, bold] = await Promise.all([
    doc.embedFont(regularBytes, { subset: true }),
    doc.embedFont(boldBytes, { subset: true }),
  ]);

  return { regular, bold };
}
```

- `subset: true` makes pdf-lib + fontkit embed only the glyphs we actually used. A typical invoice PDF ends up with fonts contributing ~25–40 kB, not the full 600 kB of source TTFs.
- The `fetch('/fonts/...')` path works because Next.js's static export copies `public/` verbatim to the deployed root. Vitest tests need a different path — see §13.

Download the two TTFs from the official Inter repository:

- `https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Regular.ttf`
- `https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Bold.ttf`

Commit them to `public/fonts/` along with `LICENSE.txt` (the SIL OFL 1.1 text from Inter's repo root).

## 8. Pagination

The dominant source of complexity in M4. pdf-lib gives you pages; it does not give you flowing layout. The approach:

1. `layout.ts` exposes a `Cursor` type: `{ page: PDFPage; y: number }`. The y-axis in PDF is 0 at the bottom and increases upward — counterintuitive. All section helpers return the new cursor after drawing.

2. Lines section keeps a running y-cursor. Before drawing each row, compute its rendered height (`nLines * 12`) including any wrapped description lines. If `cursor.y - rowHeight < FOOTER_RESERVE` where `FOOTER_RESERVE = 120`, call `addPage()` and reset cursor to the top-of-table y on the new page.

3. On pages 2+, before the table header, render a compact page-2 header:

   ```
   <Invoice title>                                       Seite 2 / Page 2
   <Invoice number>                                      
   ```

   Then re-render the table column headers.

4. Page numbers (`Seite n / N`) can only be written after the last page is known. Easiest approach: after drawing everything, loop `pdfDoc.getPages()` and draw the page-number text onto each page's footer. `drawPageNumbers(pdfDoc, fonts, labels)` runs last.

## 9. Number and date formatting

Reuse `src/lib/convert/format.ts` — specifically `formatCurrency(amount, currency, locale)` and `formatDate(iso, locale)`. Do not reimplement locale handling inside the PDF code.

Right-aligning numeric columns: measure text with `font.widthOfTextAtSize(text, 9)` and draw at `columnRight - textWidth`. Wrap this in `drawRightAlignedText(page, { x: columnRight, y, text, font, size })` in `draw.ts` so section files stay readable.

## 10. Text wrapping (for descriptions and multi-line fields)

Line items can have multi-line descriptions (the secupay case from real-world QA) with embedded `\n`. Payment terms notes can also span multiple lines. Implement a single `wrapText(text, maxWidth, font, size): string[]` helper in `draw.ts`:

- First split on `\n` / `\r\n` / `\r` (same regex as M3.1's `normalizeForLegacy`).
- Then for each resulting paragraph, word-wrap by measuring word widths until the next word would exceed `maxWidth`, push the current line, start a new line.
- Treat a single word longer than `maxWidth` as its own line (don't try to break mid-word).

Do not collapse internal whitespace. Do not trim. Output lines preserve their original spacing.

## 11. UI wiring

`src/components/FormatPicker.tsx`:
- Remove the `alwaysDisabled` treatment from the PDF tile. PDF should be selectable.
- Remove the `comingSoonBadge` rendering for the PDF option.

`src/components/Converter.tsx`:
- In the `handleConvert` switch, replace the PDF branch (currently a no-op / disabled state) with a call to `convertPdf(invoice, { locale, fallbackFilename: 'invoice' })`.
- The state machine does not need any new states — PDF goes through the same `generating → done` transitions as the other formats.

i18n — nothing to add; `comingSoonBadge` key can stay in `de.json` / `en.json` because CSV / TXT / XLSX / PDF all now work, but the key itself is unused. Leave it rather than deleting it; we may need it again when we add ZUGFeRD as a fifth format.

## 12. Test plan

Target: ≥ 85 % line coverage on `src/lib/convert/pdf*` (matching M3's bar).

PDFs are binary, so test strategy is different from CSV/TXT snapshots:

1. **Byte-level sanity** (`pdf.test.ts`)
   - Starts with `%PDF-1.` and ends with `%%EOF\n`.
   - `blob.size` within reasonable bounds: `20_000 < size < 200_000` for standard fixtures. (Subset fonts + a 1-page invoice should land ~30–60 kB.)
   - MIME type is `application/pdf`.
   - Filename matches `<sanitised>.pdf` and respects `fallbackFilename`.

2. **Structural inspection** via `PDFDocument.load()` (same `pdf-lib` round-trip):
   - Correct number of pages (1 for every fixture we ship; fabricate a 60-line-item invoice in a separate test to verify pagination → 2+ pages).
   - Page size equals A4 (595.28 × 841.89).
   - Fonts embedded: at least 2 font objects present.

3. **Content assertions** by scanning the raw bytes for key strings (pdf-lib writes text streams uncompressed by default, so strings appear verbatim for subset fonts; if compression kicks in later, fall back to pdf-lib's text extraction):
   - Invoice number appears.
   - Seller name and buyer name appear.
   - Grand total string appears in its locale-formatted form (e.g. `238,00` for the UBL standard fixture).
   - For `ubl-reverse-charge.xml`: the DE reverse-charge disclaimer text is present; no tax rate on the line.
   - For `ubl-credit-note.xml`: the title is "Gutschrift" (in DE) / "Credit note" (in EN).

4. **Per-fixture integration** (`tests/convert/integration.test.ts` — extend existing file):
   - For every fixture, `convertPdf(invoice, { locale: 'de', fallbackFilename: 'invoice' })` produces a valid PDF with non-zero size and correct filename, no thrown errors.

5. **Pagination coverage** (dedicated test):
   - Synthesise an invoice with 80 line items (clone the first line of `ubl-invoice-standard.xml` 80 times). Verify `pdfDoc.getPageCount() >= 2`. Verify page 2+ have a compact header (search for "Seite 2" substring).

Font loading in Vitest: `fetch('/fonts/...')` doesn't work in the Node test environment. In `fonts.ts`, detect the test environment and read from disk:

```ts
const loadBytes = async (path: string): Promise<ArrayBuffer> => {
  if (typeof window === 'undefined') {
    const fs = await import('node:fs/promises');
    const nodePath = await import('node:path');
    const buf = await fs.readFile(nodePath.join(process.cwd(), 'public', path));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const r = await fetch(path);
  return r.arrayBuffer();
};
```

Use `await loadBytes('fonts/Inter-Regular.ttf')` internally. Files using the `// @vitest-environment node` pragma (as in M3) will hit the Node branch automatically.

## 13. Sharp edges

1. **pdf-lib's y-axis runs bottom-up.** `page.drawText(text, { x, y })` places text with `y` as the baseline; the text extends upward from there. It's inverted from DOM. Put this in a comment at the top of `draw.ts` so future readers don't get confused.

2. **Text measurement must use the exact font + size that will render it.** `font.widthOfTextAtSize(text, 9)` for a label drawn at 9 pt. If you measure with Regular and draw with Bold, right-alignment drifts. The `drawRightAlignedText` helper should take the actual font it will use.

3. **Subsetting hazards.** pdf-lib's subsetter sometimes drops glyphs for characters that appeared only in `wrapText`'s intermediate splits but not in drawn output. Draw through the full codepath before calling `save()`. Fix if coverage complains: draw a zero-width test string with every used character to prime the subsetter.

4. **Embedded newlines in text.** `page.drawText(text)` does NOT interpret `\n`. Feed each wrapped line to its own `drawText` call, advancing y by leading. Never pass a multi-line string.

5. **Long seller or buyer names wrap too.** Assume up to 60 chars fits on one line at 9 pt Inter Regular in the half-width party block (~250 pt). Wrap using the same `wrapText` helper. Party blocks use 3–5 lines typically; no need to paginate parties.

6. **Tax rate formatting.** `19` → `19,00 %` (DE) / `19.00%` (EN). Trailing zero is intentional: matches the visual rhythm of currency columns. Implement `formatPercentage(rate, locale)` in `format.ts` (alongside the existing `formatCsvRate`).

7. **Currency symbol placement differs by locale.** DE: `238,00 €` (symbol after, space). EN: `€238.00` (symbol before). Use `Intl.NumberFormat(locale, { style: 'currency', currency })` — it handles this. Do not hardcode.

8. **Reverse-charge invoices have zero VAT.** The totals block still renders `USt: 0,00 €` — that's correct, not a bug. The reverse-charge disclaimer explains why.

9. **Mixed-rate invoices.** `cii-mixed-rate.xml` has 19 % and 7 %. Tax breakdown section renders one row per distinct rate. Line items show each line's rate next to its own row. The grand total sums across rates.

10. **Credit notes.** `typeCode === '381'`. Title text becomes `Gutschrift` / `Credit note`. Line amounts and totals should display whatever sign is already in the `Invoice` object — don't negate twice. (The parser handles the credit-note sign conventions; the PDF just draws what it's given.)

11. **IBAN formatting.** Render with spaces every 4 characters: `DE89 3704 0044 0532 0130 00`. Implement a tiny formatter in `payment.ts`: `formatIban(iban)`. Store IBANs in the model unformatted; format only for display.

12. **Large paymentTermsNote.** A 10-line terms note would crash into the footer. If after wrapping the terms note doesn't fit in the remaining y-space, truncate with an ellipsis and emit a console warning in dev. (Don't paginate terms notes — they're informational, losing a line is better than a broken layout.)

13. **Empty optional fields.** Seller contact, buyer reference, purchase-order reference, project reference, VAT IDs, BIC — any can be missing from a valid X-Rechnung. Every section must handle absence silently: no "undefined" strings, no blank-but-labelled lines. If a label would have no value, skip the whole label+value pair.

14. **Font bytes can't be relative-imported.** `import Inter from './Inter-Regular.ttf'` does not work with Next.js static export + pdf-lib's `embedFont(ArrayBuffer)`. Must be fetched from `/fonts/...`. Don't be tempted to base64-inline them either — the initial JS bundle balloons and the file becomes illegible to diff readers.

15. **Bundle size guard.** After M4, check `pnpm build` output. `pdf-lib` + `@pdf-lib/fontkit` should be code-split into their own chunk, loaded only when the user picks PDF. If they land in the main chunk, the dynamic import isn't working — investigate before shipping.

## 14. Acceptance criteria

- Every fixture in `samples/` generates a valid PDF via `convertPdf` with no thrown errors.
- Page 1 of the UBL standard fixture visually contains: seller letterhead (top-left), invoice title + metadata (top-right), buyer block, single-line-item table, totals, payment info, footer.
- The credit-note fixture renders with title "Gutschrift" in DE and "Credit note" in EN.
- The reverse-charge fixture renders the disclaimer text and `—` in the tax-% column; VAT total is `0,00 €`.
- The mixed-rate fixture renders two tax-breakdown rows.
- A synthetic 80-line-item fixture paginates to ≥ 2 pages and every page has a footer with `Seite n / N`.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass.
- Coverage on `src/lib/convert/pdf*` ≥ 85 % lines.
- Main bundle does not regress by more than 5 kB; `pdf-lib` + `@pdf-lib/fontkit` live in their own dynamically-loaded chunk.
- PDF tile in `FormatPicker` is selectable on plainvoice.de — no "Bald verfügbar" badge.
- PR title: `M4: branded A4 PDF generation (DE/EN)`

## 15. Manual QA (for Yves, after merge)

- Open a generated PDF in: Acrobat Reader, macOS Preview, Firefox built-in, Chrome built-in. Text selectable, glyphs correct (ä, ö, ü, ß, €), no missing-glyph boxes.
- Print one to paper — confirm no clipping at margins.
- Open the 80-line synthetic on screen + print; page breaks sensible.
- Toggle UI to EN, generate again; all labels swap, no DE leakage.

## 16. Handoff to Cowork for review

Before ending the session:

1. Make sure the main checkout at `~/Documents/Codex/x-rechnung-conversion` is on the feature branch you worked on (not `main` or a sub-worktree). Run `git -C ~/Documents/Codex/x-rechnung-conversion status` to confirm — should show `On branch m4-pdf` (or whatever branch name you chose) with a clean tree. If it's not on the feature branch, switch it:

```bash
cd ~/Documents/Codex/x-rechnung-conversion
git fetch origin
git checkout <feature-branch>
```

2. Report the final commit SHA, the branch name, and the PR URL in your finish message.

This lets Cowork review the PR by reading the mount directly — no git commands needed from the user.
