# M3.1 — CSV compatibility modes (modern vs. legacy)

Small follow-up to M3. Adds a "Kompatibilität / Compatibility" option to the CSV panel with two modes. Resolves a QA finding: CSVs that embed `\n` inside quoted fields render correctly when Excel opens them directly, but break when imported via "Get Data → From Text (Legacy)" or DATEV — each embedded newline becomes a new row.

## Branch

Start from `main` after M3 is merged:

```bash
git checkout main && git pull
git checkout -b m3-1-csv-compat
```

## Changes

### 1. `src/lib/convert/types.ts`

Add a compatibility type and extend `CsvOptions`:

```ts
export type CsvCompatibility = 'modern' | 'legacy';

export interface CsvOptions extends BaseOptions {
  compatibility: CsvCompatibility;
  layout: CsvLayout;
  separator: CsvSeparator;
  decimal: CsvDecimal;
}
```

### 2. `src/lib/convert/csv.ts`

Add a single helper and call it from `encodeCell`:

```ts
const LEGACY_NEWLINE_REPLACEMENT = ' · ';

function normalizeForLegacy(value: string): string {
  // Collapse CRLF, CR, and LF. Then squash runs of the replacement.
  return value
    .replace(/\r\n|\r|\n/g, LEGACY_NEWLINE_REPLACEMENT)
    .replace(/(\s·\s){2,}/g, LEGACY_NEWLINE_REPLACEMENT);
}
```

Wire `compatibility` through `convertCsv` so that when `options.compatibility === 'legacy'`, every string cell is passed through `normalizeForLegacy` **before** `needsQuoting`/`quote` run. Numeric cells are untouched.

Keep RFC 4180 quoting identical in both modes — the only behavioural difference is the newline collapse. Both modes still emit UTF-8 BOM + CRLF.

Filename suffix: append `-legacy` before the extension in legacy mode (e.g. `INV-2026-0001-legacy.csv`) so users can tell the two apart if they download both.

### 3. `src/components/CsvOptions.tsx`

Add a new `RadioGroup` **above** Layout:

- Field: `compatibility`
- Options: `modern` (default), `legacy`
- Use the same visual treatment as the other three radios.
- Each option renders its hint (second line, muted) under the label — the hint is important for this choice specifically.

Default to `modern`. Persist in the component's existing state shape.

### 4. `src/components/Converter.tsx`

Thread `compatibility` through the `CsvOptions` state the same way `layout`/`separator`/`decimal` are threaded. Initial state: `compatibility: 'modern'`.

### 5. i18n — `src/i18n/messages/de.json`

Add under `Converter`:

```json
"csvCompatibility": "Kompatibilität",
"csvCompatibilityModern": "Modern",
"csvCompatibilityModernHint": "Für Excel (Direktöffnen), Numbers, Google Sheets. Folgt RFC 4180 mit Zeilenumbrüchen in Zellen.",
"csvCompatibilityLegacy": "Legacy",
"csvCompatibilityLegacyHint": "Für Power Query „Aus Text (Legacy)\", DATEV, ältere Importer. Zeilenumbrüche in Zellen werden durch „ · \" ersetzt."
```

### 6. i18n — `src/i18n/messages/en.json`

```json
"csvCompatibility": "Compatibility",
"csvCompatibilityModern": "Modern",
"csvCompatibilityModernHint": "For Excel (double-click), Numbers, Google Sheets. RFC 4180 with line breaks inside cells.",
"csvCompatibilityLegacy": "Legacy",
"csvCompatibilityLegacyHint": "For Power Query 'From Text (Legacy)', DATEV, older importers. Line breaks inside cells are replaced with ' · '."
```

### 7. Tests — `tests/convert/csv.test.ts`

Add a `describe('compatibility', …)` block:

- `modern` mode — given a line item whose `description` contains `\n`, the resulting CSV has the newline preserved inside quotes (existing behaviour).
- `legacy` mode — same input → newline replaced by ` · `, field still quoted only if it contains the separator or quotes.
- `legacy` mode — CRLF and lone CR also collapse to ` · `.
- `legacy` mode — runs of three or more newlines collapse to a single ` · `.
- `legacy` mode — numeric columns (quantity, unitPrice, netAmount) are byte-identical to `modern` mode.
- Filename suffix — `legacy` mode produces `*-legacy.csv`; `modern` mode produces `*.csv`.
- Snapshot one full legacy-mode CSV using the existing secupay-style fixture so future regressions are caught.

Coverage target unchanged (≥ 85% on `src/lib/convert/`). Expect to stay at / near the current 99.42%.

## Acceptance

- Opening the `modern` CSV by double-click in Excel: multi-line descriptions stay in one cell. ✓ (existing behaviour)
- Importing the `legacy` CSV via "Get Data → From Text (Legacy)" in Excel: each invoice line is exactly one Excel row; descriptions are single-line with ` · ` separators. ✓
- Both variants parse cleanly in LibreOffice, Numbers, and Google Sheets.
- `pnpm test` and `pnpm lint` pass.
- PR title: `M3.1: CSV modern/legacy compatibility modes`
- PR body links back to PR #3 and cites the Power Query QA finding.

## Out of scope

- TXT and XLSX are unchanged — only CSV has this compatibility split.
- No new converter file; this is entirely inside the existing `convertCsv`.
- No change to the CSV layout / separator / decimal options.
