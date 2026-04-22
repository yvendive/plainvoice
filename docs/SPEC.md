# Plainvoice — Product Spec (v1)

**Status:** Draft v0.1 — P0 decisions locked 2026-04-21, awaiting Yves sign-off on details
**Relates to:** `docs/RESEARCH.md` (the "why"); this doc is the "what"
**Target release:** MVP / v1

This is the PRD for v1. It captures what we're building, what it does, and how we'll know when it's done. Anything not listed here is explicitly **out of scope** for v1.

---

## 0. What is Plainvoice?

Plainvoice converts German X-Rechnung XML invoices into the formats humans actually use — CSV, TXT, XLSX, PDF — directly in the browser. The invoice never leaves the visitor's machine. The name plays on *plain* (clear, straightforward) and *voice* (finally giving the opaque XML a voice a person can understand). Sibling brand to plain-cards.com.

## 1. Goals

- Let a user convert a single X-Rechnung XML file into **one** of CSV, TXT, XLSX, or PDF — in their browser, in under 10 seconds end-to-end.
- Work for both **UBL 2.1** and **UN/CEFACT CII** syntaxes, detected automatically.
- Offer UI in **German** (default) and **English**.
- Never send the invoice anywhere. Entire pipeline runs client-side.

## 2. Non-goals (v1)

- Accounts, saved history, API access, paid tiers.
- Batch uploads, ZIP downloads. *(v1.1 candidate.)*
- ZUGFeRD / Factur-X PDF input (PDF/A-3 with embedded XML). *(v1.1 candidate.)*
- Creating / editing / signing X-Rechnungen.
- Full KoSIT Schematron validation. We do structural sanity checks only and link out to external validators if the user wants strict validation.
- Official KoSIT visualization fidelity. We ship a neutral branded PDF in v1; an "offizielle Ansicht" toggle is v1.1.

## 3. Primary personas

- **Freelancer / small-business owner** — receives an X-Rechnung XML and needs a PDF for their records or a CSV/XLSX to hand to their accountant.
- **Tax advisor / bookkeeper (Steuerberater)** — occasionally receives X-Rechnungen from clients who lack software; needs a quick readable export.
- **Developer / integrator** — wants a trustworthy, open tool to understand the format or to recommend to non-technical users.

## 4. User flow

```
[1. Landing page]                                 [2. File chosen]
  ┌───────────────────────────┐                     ┌───────────────────────────┐
  │ X-Rechnung Konverter      │                     │ ✓ invoice-123.xml         │
  │ DE | EN                   │                     │   Format: UBL 2.1         │
  │                           │      user drops     │   Rechnung #INV-2026-042  │
  │  [  Drop XML file here ]  │  ─────────────►     │                           │
  │  or click to browse       │                     │ Choose output format:     │
  │                           │                     │  ◉ PDF                    │
  │ 100% im Browser.          │                     │  ○ XLSX                   │
  │ Nichts wird hochgeladen.  │                     │  ○ CSV                    │
  └───────────────────────────┘                     │  ○ TXT                    │
                                                    │                           │
                                                    │  [ Konvertieren ]         │
                                                    └───────────────────────────┘
                                                                │
                                                                ▼
                                                    ┌───────────────────────────┐
                                                    │ ✓ Ready                   │
                                                    │ [ Download invoice.pdf ]  │
                                                    │                           │
                                                    │ Convert another file →    │
                                                    └───────────────────────────┘
```

**Happy path steps**

1. User lands on `/`. UI language auto-detects (German default; overridable via DE/EN toggle, persisted in `localStorage`).
2. User drops or selects an XML file (≤ 10 MB).
3. Client parses XML → detects UBL or CII → normalises into internal `Invoice` model.
4. UI shows a short *confirmation card*: filename, detected syntax, invoice number, issue date, seller name, buyer name, grand total — so the user can verify the right file was picked up.
5. User picks output format (radio buttons, default PDF).
6. User clicks **Konvertieren / Convert**.
7. Browser generates the output and triggers a download with sensible filename, e.g. `INV-2026-042.pdf`.
8. UI shows success state + "Convert another file" link.

**Error paths**

- Non-XML file → inline error: *"Nur XML-Dateien werden unterstützt."*
- Valid XML but not an X-Rechnung (neither UBL Invoice nor CII CrossIndustryInvoice root) → *"Diese Datei scheint keine X-Rechnung zu sein."*
- Parseable but missing EN 16931 must-have fields (invoice number, issue date, seller, buyer, at least one line item or total) → block conversion, list missing fields.
- Parseable with warnings (nice-to-have fields missing) → allow conversion, show yellow banner listing what's missing.

## 5. UI requirements

- **Single page app**, two states: *landing* → *working with a file*. No routing beyond `/` and `/datenschutz` (privacy).
- **Language toggle** in header (DE/EN). Persists in `localStorage` key `xrc.lang`.
- **Dark mode** — nice to have, defer if time-tight.
- **Accessibility:** WCAG 2.1 AA. Drop zone must be keyboard-operable, file picker reachable via Tab, all interactive elements labelled.
- **Mobile:** functional down to 360 px wide. Upload via device file picker.

**Visual direction:** minimal, white/neutral, sans-serif (Inter), generous whitespace. No hero images. One accent colour. The tool should feel like a utility, not a marketing page.

## 6. Output format specifications

### 6.1 PDF (default, per P0 decision)

- **Layout:** neutral branded invoice design (header block with seller/buyer, meta block with invoice #/dates/Leitweg-ID, line-item table, tax breakdown, totals, payment info, notes footer).
- **Language:** matches UI language.
- **Page size:** A4.
- **Font:** embedded Inter (or Noto Sans) — must render €, ß, ä/ö/ü correctly.
- **Library:** `pdf-lib` + `@pdf-lib/fontkit`.
- **Filename:** `{InvoiceNumber}.pdf` (sanitised; fallback `rechnung.pdf`).
- **Acceptance:** side-by-side review vs. three reference X-Rechnungen (one UBL, one CII, one credit note).
- **v1.1:** add an "Offizielle KoSIT-Ansicht" toggle that applies the official `xrechnung-visualization` XSLT instead.

### 6.2 XLSX (multi-sheet, per P0 decision)

- **Three sheets:**
  1. **Overview** — all header-level EN 16931 fields as labelled key/value pairs (seller, buyer, invoice #, dates, Leitweg-ID, payment terms, totals).
  2. **Line items** — one row per invoice line (item name, description, quantity, unit, unit price, net amount, tax rate, tax amount, line total).
  3. **Tax breakdown** — aggregated tax categories (tax rate, taxable amount, tax amount).
- **Library:** `ExcelJS`.
- **Formatting:** frozen header row, column widths auto-sized, currency format for money columns, date format for date columns.
- **Locale:** cell display formats follow UI language (DE: comma decimal, `1.234,56 €`; EN: `1,234.56 €`).
- **Filename:** `{InvoiceNumber}.xlsx`.
- **Acceptance:** opens cleanly in MS Excel 2019+, LibreOffice Calc, Numbers; column widths sensible; formulas not required but currency/date formats must be correct.

### 6.3 CSV (both layouts, per P0 decision)

- **Radio toggle on the format card:** *Eine Zeile pro Rechnung* (header-only) / *Eine Zeile pro Position* (line-items, **default**).
- **Encoding:** UTF-8 with BOM (so Excel opens it correctly without a locale prompt).
- **Separator:** `;` (German convention). Configurable in a small expandable "Optionen" section, alongside a decimal-separator toggle (`,` default, `.` alternative).
- **Quoting:** RFC 4180 — wrap fields containing separator, quote, or newline in double quotes; escape `"` as `""`.
- **Header row:** localised to UI language.
- **Filename:** `{InvoiceNumber}.csv`.
- **Acceptance:** importable into Excel and DATEV without warnings; round-trips through Google Sheets without character corruption.

### 6.4 TXT (human-readable, per P0 decision)

- **Layout:** plain text report — labelled key/value block for header (fixed-width labels, left-aligned values), then an aligned ASCII table for line items, then tax breakdown, then totals.
- **Language:** matches UI language.
- **Encoding:** UTF-8.
- **Line endings:** `\r\n` (Windows-friendly).
- **Filename:** `{InvoiceNumber}.txt`.
- **Acceptance:** opens and displays correctly in Notepad, TextEdit, and any modern terminal without character corruption.

## 7. Field mapping (internal Invoice model)

We map **both** UBL and CII into a single TypeScript `Invoice` type that covers the ~30 EN 16931 business terms used for all four outputs. Full mapping table goes in `docs/MAPPING.md` (Claude Code creates this during implementation). Minimum fields the model must expose:

- Invoice number, issue date, due date, invoice type code (380 invoice / 381 credit note / …), currency
- Seller: name, VAT ID, address, contact
- Buyer: name, VAT ID, address, Leitweg-ID
- Line items: id, name, description, quantity, unit, unit price, net amount, tax category + rate, tax amount, line total
- Tax breakdown (per rate): taxable amount, tax amount, tax category
- Document-level allowances and charges (optional but captured if present)
- Totals: sum of line nets, total allowances, total charges, taxable amount, total tax, rounding, grand total, paid amount, amount due
- Payment terms: due date, IBAN, BIC, account holder, mandate reference, payment means code
- Free-text notes / remarks

## 8. Telemetry & analytics (v1)

- **Plausible Analytics** (self-hostable, no cookies, GDPR-friendly) — page views only, goal: "Converted a file".
- We do **not** log filename, file size, detected syntax, or any invoice content. Verify this in code review.
- Sentry for error reporting, **scrubbed aggressively** — stack traces only, never invoice content (treat anything in `Invoice` objects as PII).

## 9. Acceptance criteria (definition of done for v1)

- [ ] Deployed at a public URL with a custom domain (TBD).
- [ ] Lighthouse ≥ 90 on Performance, Accessibility, Best Practices, SEO.
- [ ] Passes parsing on all `samples/` fixtures (at least 5 UBL + 5 CII, covering invoices and credit notes).
- [ ] All four outputs produce downloadable, correctly formatted files for each fixture.
- [ ] DE and EN UI strings reviewed by a native speaker each.
- [ ] Privacy page `/datenschutz` published, linked in footer.
- [ ] MIT license in repo, project README accurate.
- [ ] GitHub Actions: lint + typecheck + test + build green on every push.
- [ ] One-click deploy to Vercel preview works on every PR.

## 10. Milestones (from RESEARCH §12)

| Milestone | Deliverable | Who |
| --- | --- | --- |
| M0 — Spec | This doc + RESEARCH.md, signed off | Cowork (Claude PM) |
| M1 — Scaffold | Next.js + TS + Tailwind + next-intl + CI + preview URL, placeholder UI | Claude Code (brief: `docs/handoffs/01-scaffold.md`) |
| M2 — Parser | UBL + CII parsers → Invoice model, unit tests | Claude Code |
| M3 — Converters | CSV + TXT + XLSX generators | Claude Code (CSV/TXT), optionally Codex (XLSX) |
| M4 — PDF | pdf-lib generator | Claude Code |
| M5 — Launch | Copy, privacy, domain, analytics, public release | Cowork + Yves |

## 11. Brand, hosting, and related decisions (locked 2026-04-21)

- **Brand name: Plainvoice.** Stays in the plain-cards.com brand family. Taglines in exploration: DE "Rechnungen im Klartext." / EN "Your X-Rechnung, in plain sight."
- **Domain:** TBD — check availability of `plainvoice.de`, `plainvoice.app`, `plainvoice.io`, `plainvoice.com`. Pick in M5.
- **Production hosting: easyname Large Hosting** (Yves' existing vhost). We deploy a static export (`next build` with `output: 'export'`) via SFTP. SSL via Let's Encrypt (included). Unlimited traffic, 75 GB disk.
- **Preview hosting: Vercel free tier** for PR preview deploys only. No production traffic there.
- **ZUGFeRD / Factur-X PDF input:** deferred to v1.1.
- **XRechnung 2.x invoices:** parse best-effort, warn about deprecated version.

## 12. Sign-off

- [ ] Yves — reviewed SPEC.md, happy with §6 output details
- [ ] Cowork (Claude) — spec is consistent with RESEARCH.md
- [ ] Claude Code — received `docs/handoffs/01-scaffold.md`, ready to start M1
