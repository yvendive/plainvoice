# Progress Log

Session-level status for the Plainvoice project. For the "why" behind decisions, see `docs/RESEARCH.md`. For the "what", see `docs/SPEC.md`.

## 2026-04-22 — M3 converters + drop-zone wiring

**Done**
- Added `src/lib/convert/` with three converters against a shared `ConverterResult` contract: `csv.ts` (RFC 4180 quoting, UTF-8 BOM, CRLF, `;` / `,` / `\t` separator × `,` / `.` decimal, line-items + header-only layouts), `txt.ts` (64-col fixed-width layout with box-drawing header, credit-note variant via `typeCode === '381'`, reverse-charge exemption line), `xlsx.ts` (three sheets — Overview / Lines / Tax — via `await import('exceljs')` so the 200 kB lib stays off the initial chunk, frozen header rows, locale-aware currency formats, auto-sized columns clamped to `[12, 60]`).
- Shared helpers: `filename.ts` (`invoiceFilename(invoice, ext)` — sanitises unsafe chars, caps at 80 chars, falls back to `'invoice'`), `format.ts` (cached `Intl.NumberFormat` for DE/EN, ISO dates + `dd.mm.yyyy`, CSV-specific amount/quantity formatters that respect the chosen decimal), `labels.ts` (single DE/EN `LabelBundle` consumed by all three converters so the converter library runs pure without an i18n context).
- Rewrote `FileDropZone` as a controlled component (`onFile` / `onTooBig` / `disabled` props, 10 MB cap) and introduced `Converter.tsx` as the new page host — a `useReducer` state machine (`idle → parsing → ready → generating → done` / `invalid`) that owns parse dispatch, triggers a `URL.createObjectURL` download, and renders the result panel. Placeholder toast and `Toast.tsx` removed.
- New presentational components: `ConfirmationCard` (key invoice fields), `FormatPicker` (PDF/XLSX/CSV/TXT grid with PDF always disabled + "Bald verfügbar" badge), `CsvOptions` (collapsible details with RadioGroup triplet; picking separator `,` auto-flips decimal to `.` per §9.2 gotcha), `ErrorCard`, `ResultPanel`.
- Added ~40 `Converter.*` i18n keys in both `de.json` and `en.json` — statuses, format labels, CSV options, error messages, warnings, fallback filename.
- Vitest suite in `tests/convert/` (7 files, 80+ tests) covering filename sanitisation, number/date formatting, label localisation, CSV quoting / BOM / decimal swap / all separators / both layouts, TXT snapshot per fixture, XLSX round-trip via ExcelJS (sheet names, row counts, frozen panes, currency format, column-width clamp), plus an end-to-end integration suite that walks every fixture through each converter. Files use the `// @vitest-environment node` pragma so `Blob.arrayBuffer()` / `Blob.text()` work. BOM assertion decodes raw bytes with `ignoreBOM: true` because `TextDecoder` strips the BOM by spec.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass locally. Coverage on `src/lib/convert/`: **99.42 % lines, 87.5 % branches, 100 % functions** (well above the ≥85 % line-threshold from the brief).

**Next (Yves)**
- Manual QA per §7.3 of the handoff: open generated CSV in Excel + DATEV importer, open XLSX in Excel / Numbers / LibreOffice, open TXT in Notepad + TextEdit, drop non-XML + non-X-Rechnung files, toggle DE/EN.

**Next (Cowork, me)**
- Write `docs/handoffs/04-pdf.md` — PDF generation via `pdf-lib` + `@pdf-lib/fontkit` (branded layout, A4, DE/EN, embedded Inter/Noto Sans).

## 2026-04-22 — M2 UBL + CII parsers

**Done**
- Added `Invoice` Zod schema in `src/lib/invoice/schema.ts` (EN 16931 business terms grouped as document → parties → lines → allowances → tax → totals → payment → provenance), with `z.infer` types.
- UBL parser in `src/lib/invoice/parsers/ubl.ts` handles both `<Invoice>` and `<CreditNote>` via a shared core (branch on root + line tag + quantity tag).
- CII parser in `src/lib/invoice/parsers/cii.ts` normalises `udt:DateTimeString format="102"` to ISO and widens `format="610"` to day 01 with a warning.
- Structural dialect detection in `src/lib/invoice/parsers/detect.ts` — fingerprints via root name + signature children, since `removeNSPrefix: true` strips xmlns attributes.
- Top-level `parseInvoice(xml)` in `src/lib/invoice/index.ts` sniffs syntax and dispatches. Discriminated-union result type, no throws at the module boundary.
- Three edge-case fixtures in `samples/`: `ubl-credit-note.xml`, `cii-mixed-rate.xml` (19% + 7%), `ubl-reverse-charge.xml` (intra-EU, category AE).
- Vitest suite (5 files, 68 tests): positive path for all 5 fixtures, negative path for parse failures and missing required fields, helper unit tests, detect-module edge cases, version-warning coverage. `pnpm test:coverage` → 94.59% lines / 100% functions on `src/lib/invoice/` (≥90% line threshold from the brief).
- `docs/MAPPING.md` with full UBL→Invoice and CII→Invoice field tables keyed to EN 16931 BT codes.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass locally.

**Next (Cowork, me)**
- Write `docs/handoffs/03-converters.md` — CSV + TXT + XLSX generation and wiring the drop zone.

## 2026-04-22 — M1 scaffold

**Done**
- Scaffolded Next.js 15 + TypeScript (strict) + Tailwind CSS 4 + `next-intl` 3.x, following `docs/handoffs/01-scaffold.md`.
- Static export build (`output: 'export'`) so the app is portable to easyname / any static host.
- Bilingual routing under `src/app/[locale]/` with DE default and EN toggle; locale persisted in `localStorage` key `xrc.lang`.
- Placeholder landing page with non-functional drop zone (shows a "Coming soon" toast on file select) and privacy stub at `/datenschutz`.
- Lightweight, hand-rolled shadcn-style primitives (`button`, `card`, `alert`, `radio-group`) in `src/components/ui/`.
- GitHub Actions CI workflow (lint + typecheck + test + build on Node 22) and a stubbed `deploy.yml` for easyname SFTP with `# TODO: populate secrets`.
- Smoke test covering i18n config + message catalogs (`pnpm test` green locally).

**Next (Yves)**
- Register the `plainvoice.*` domain and share the final choice.
- Provide easyname SFTP credentials as GitHub Actions secrets (`EASYNAME_HOST`, `EASYNAME_USER`, `EASYNAME_PASSWORD`, `EASYNAME_REMOTE_PATH`).
- Link the repo to Vercel so PR previews come online.

**Next (Cowork, me)**
- Write `docs/handoffs/02-parser.md` for UBL + CII parsers → `Invoice` model once M1 is merged.

## 2026-04-21 — Kickoff + spec + brand + repo live

**Repo:** https://github.com/yvendive/plainvoice (private)
**Domain:** plainvoice.de (ordered via easyname)
**First commit:** 493f27d — initial planning docs + MIT license


**Done**
- Agreed scope with Yves: browser-only, Next.js + TS, DE+EN UI, MVP (single upload → single output → download).
- Set up repo scaffolding (`docs/`, `docs/handoffs/`, `samples/`, `src/`).
- Wrote `docs/RESEARCH.md` v0.1 — project source of truth.
- P0 decisions locked (PDF: branded/simple for v1; CSV: both layouts, default line-items; XLSX: multi-sheet; TXT: human-readable).
- Wrote `docs/SPEC.md` v0.1 — product spec incorporating P0 decisions.
- Wrote `docs/handoffs/01-scaffold.md` — tight implementation brief for Claude Code to deliver M1.
- **Brand name locked: Plainvoice** (sibling to plain-cards.com). Taglines: DE "Rechnungen im Klartext." / EN "Your X-Rechnung, in plain sight."
- **Hosting locked: easyname Large Hosting** for production (static export via SFTP on push to `main`); Vercel free tier for PR previews only.
- ZUGFeRD / Factur-X PDF input: deferred to v1.1.

**Next (Yves)**
- Register a `plainvoice.*` domain (candidates: .de, .app, .io, .com).
- Provide easyname SFTP credentials as GitHub Actions secrets (`EASYNAME_HOST`, `EASYNAME_USER`, `EASYNAME_PASSWORD`, `EASYNAME_REMOTE_PATH`).
- Sign off on `docs/SPEC.md`.

**Next (Claude Code)**
- Receive `docs/handoffs/01-scaffold.md` → scaffold Next.js 15 + TS + Tailwind + shadcn/ui + next-intl. Static-export build. CI green. Vercel preview URL up.

**Next (Cowork, me)**
- Once M1 is live, write `docs/handoffs/02-parser.md` for UBL + CII parsers → `Invoice` model.

**Blocked on**
- Yves sign-off on `docs/SPEC.md`.
- Domain registration.
- easyname SFTP credentials (needed before first production deploy, not before M1 preview).

**Owner map**
- PM/PO: Claude (Cowork)
- Implementation: Claude Code (primary), Codex (optional for XLSX module)
- Ad-hoc: Claude Chat
