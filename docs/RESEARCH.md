# X-Rechnung Conversion Tool — Research & Project Brief

**Status:** Draft v0.1 — initial research, awaiting review by Yves
**Last updated:** 2026-04-21
**Owner (PM/PO):** Claude (Cowork)
**Implementation:** Claude Code (primary), Codex (optional, scoped tasks)

This document is the single source of truth for the project. Decisions, open questions, library choices, and the project roadmap live here. We update it as we learn. `PROGRESS.md` at the repo root tracks week-by-week status; this file tracks the "why" behind decisions.

---

## 1. Product one-liner

A free, privacy-first web tool that converts an **X-Rechnung** XML file into **CSV, TXT, XLSX, or PDF** — entirely in the user's browser, with German and English UI.

## 2. Why this is worth building

- Since **1 January 2025** every German business must be able to *receive* electronic invoices in the X-Rechnung or ZUGFeRD format. Mandatory *issuing* phases in: from **1 January 2027** for businesses with prior-year turnover > €800 k; from **1 January 2028** for *all* domestic B2B invoices (Wachstumschancengesetz, March 2024). Millions of SMEs and freelancers are already receiving X-Rechnung XML files they cannot easily read.
- Existing tools either (a) are locked inside paid accounting suites, (b) only render a PDF for viewing, or (c) ship as desktop installs (e.g. Perfect E-Rechnung, OpenXRechnungToolbox).
- A clean browser-only converter that outputs the four most useful formats and never uploads the invoice covers a real gap — recipients who just need to file, archive, or re-key the invoice into another system.

## 3. Scope (agreed with Yves, 2026-04-21)

| Decision | Choice |
| --- | --- |
| Architecture | **Browser-only** (static site, zero server-side invoice processing) |
| Tech stack | **Next.js 15 + TypeScript** (App Router, React Server Components where safe) |
| UI language | **German (default) + English** |
| v1 scope | **MVP: one upload → one output → one download.** No accounts, no history, no batch. |

**Out of scope for v1:**

- User accounts, saved conversions, API access, paid tiers
- Batch / zip downloads (deferred to v1.1)
- *Generating* X-Rechnung from scratch or from PDF (deferred; we only *read* X-Rechnung)
- ZUGFeRD / Factur-X (PDF/A-3 with embedded XML) input — nice-to-have for v1.1 (see §11)

## 4. What is an X-Rechnung, exactly?

X-Rechnung is the German CIUS (Core Invoice Usage Specification) of the European e-invoicing standard **EN 16931**. It is a **pure XML file** with no visual representation of its own — designed for automated machine processing, not human reading.

**Two permitted XML syntaxes** (both are valid X-Rechnung):

1. **UBL 2.1** (Universal Business Language, OASIS) — used widely in Peppol and the Nordics. Element `<Invoice>` or `<CreditNote>` as root.
2. **UN/CEFACT CII** (Cross Industry Invoice) — used in ZUGFeRD and more common in German enterprises. Root `<rsm:CrossIndustryInvoice>`.

Both carry the same business facts from EN 16931; only the XML shape differs. A conformant converter must accept **both**.

**Current version (April 2026):** XRechnung **3.0.2 — Bundle "Winter 2025/26 Bugfix"**, released 31 January 2026. Version 3.0 took effect 1 February 2024 and 2.3 was retired the same day.

**On the horizon:** **XRechnung 4.0**, the German implementation of **EN 16931-1:2026** (approved by CEN in February 2026, publication expected mid-2026). Expected changes: ViDA alignment, native XML attachments in the core invoice, multi-order billing. A pre-release spec is available to software providers. Our parser should be structured so that a v4.0 profile can be added without rewriting the internal Invoice model.

**Governing body:** **KoSIT** (Koordinierungsstelle für IT-Standards), via the `xeinkauf.de` portal. Reference tooling lives at `github.com/itplr-kosit`.

Related (but distinct) formats:

- **ZUGFeRD / Factur-X** — a *hybrid* PDF/A-3 with XML embedded as an attachment. Same XML (CII profile), different container. Reading these means unzipping the XML out of the PDF first.
- **Peppol BIS Billing 3.0** — the European Peppol profile. Also a CIUS of EN 16931. UBL syntax. Mostly compatible with XRechnung but has different business rules.

## 5. User flow (v1)

```
[Landing page, DE/EN toggle]
        │
        ▼
[Drop / choose XML file]
        │
        ▼  (parse & detect UBL vs CII, build internal invoice model)
        │
[Pick output format: CSV · TXT · XLSX · PDF]
        │
        ▼
[Preview + Download button]
```

Everything from parse to download happens in the browser tab. The file never leaves the user's machine.

## 6. Technical architecture

### 6.1 Parsing

- Read file via `File` API (`<input type="file">` or drag-and-drop).
- Parse XML with **`fast-xml-parser`** (MIT, zero deps, runs in browsers, ~20 kB gzipped). `DOMParser` is a fine fallback but `fast-xml-parser` gives us a plain JS object that's easier to normalise.
- Detect syntax by inspecting the root element / namespaces:
  - `<Invoice xmlns="urn:oasis:...:Invoice-2">` → UBL
  - `<rsm:CrossIndustryInvoice>` → CII
- Normalise into a **single internal `Invoice` type** (TypeScript) covering the ~160 EN 16931 business terms we care about (seller, buyer, invoice number, issue date, due date, line items, tax breakdown, totals, payment terms, Leitweg-ID, etc.).
- *Optional but recommended:* light structural validation (not full KoSIT validation — that requires Schematron + Java). We just check the invoice is parseable and has the required EN 16931 business-term fields; we surface a warning for missing fields but still convert on a best-effort basis.

### 6.2 Output generators

| Format | Library | License | Notes |
| --- | --- | --- | --- |
| **CSV** | hand-rolled (< 50 LOC) | — | UTF-8 with BOM so Excel opens it correctly; semicolon separator by default for DE locale, configurable. Two layouts: *header-only* (1 row = 1 invoice) and *line-items* (1 row per line, header repeated). User chooses. |
| **TXT** | hand-rolled | — | Human-readable plain text — labelled key/value block for header, simple aligned table for line items. German by default, English toggle. |
| **XLSX** | **ExcelJS** | MIT | Picked over SheetJS: ExcelJS is fully MIT (SheetJS Community Edition has caveats and the commercial Pro edition is the main actively-maintained line). Supports formulas, column widths, basic styling, and runs client-side. Multi-sheet layout: *Overview* (header fields), *Line items*, *Tax breakdown*. |
| **PDF** | **pdf-lib** + **fontkit** (for UTF-8 / € / ß) | MIT | We render a branded invoice layout (seller/buyer blocks, line-item table, totals). *Option B:* port the KoSIT `xrechnung-visualization` XSLT to produce an HTML preview, then print-to-PDF via `html2pdf.js` or `pagedjs` — higher fidelity to the official look but heavier. Decision deferred — see open questions §11. |

**Why not SheetJS?** The Community Edition is Apache-2.0 but is effectively unmaintained; the actively-developed SheetJS Pro requires a commercial licence. ExcelJS (MIT, maintained, ~2M weekly downloads) is a cleaner fit for an open-source project.

**Why not jsPDF?** jsPDF has a weaker UTF-8 story (needs font subsetting workarounds for € and umlauts). `pdf-lib` with `@pdf-lib/fontkit` embedding a German-friendly font (e.g. Inter, Source Sans, or Noto Sans) handles this cleanly.

### 6.3 Frontend

- **Next.js 15** App Router, **TypeScript**, **Tailwind CSS**, **shadcn/ui** for components.
- **i18n:** `next-intl` — two JSON message catalogs (`de.json`, `en.json`). Language detection from `Accept-Language`, user can toggle.
- All conversion logic lives in `'use client'` components / utilities; no server actions touch invoice data.
- Deployable as a **static export** (`next export`) to Vercel, Netlify, Cloudflare Pages, GitHub Pages, or any static CDN.

### 6.4 What we do NOT build (and why)

- **Not a validator.** Official KoSIT validation requires the Schematron rule set + a Java runtime. We link out to `invoice-portal.de` or `invoicenavigator.eu` for validation if the user needs it.
- **Not a generator.** Creating new X-Rechnungen from scratch is a different product. `e-invoice-eu` (gflohr, MIT) already exists if we ever want to go there.

## 7. Recommended libraries (summary)

| Dependency | Purpose | License | Version target |
| --- | --- | --- | --- |
| `next` | framework | MIT | 15.x |
| `react`, `react-dom` | UI | MIT | 19.x |
| `typescript` | types | Apache-2.0 | 5.x |
| `tailwindcss` | styles | MIT | 4.x |
| `shadcn/ui` (copy-in) | components | MIT | latest |
| `next-intl` | i18n | MIT | 3.x |
| `fast-xml-parser` | XML → JS | MIT | 4.x |
| `exceljs` | XLSX generation | MIT | 4.x |
| `pdf-lib` | PDF generation | MIT | 1.x |
| `@pdf-lib/fontkit` | font embedding | MIT | 1.x |
| `zod` | schema validation | MIT | 3.x |
| `vitest` | tests | MIT | 2.x |

All client-side friendly, all permissively licensed, no runtime server dependency.

## 8. Competitive landscape

**Pricing snapshot:** 28 April 2026. All prices in € (net unless noted), per German vendor pages. SaaS prices are list prices — most vendors run rolling 30–60 % "first months" promotions that we ignore here. Enterprise networks are quoted "auf Anfrage" and we do not invent numbers.

We split the field into three buckets: (a) direct *converter / viewer* tools that compete head-on with our scope, (b) accounting / invoicing SaaS that include X-Rechnung handling as one feature among many, and (c) enterprise e-invoicing networks. Bucket (a) is where we have to differentiate on craft; bucket (b) is what most SMEs already pay for; bucket (c) is irrelevant to our target user but worth naming so we don't pretend the market starts and ends with us.

### 8.1 Direct competitors — XML viewers, validators, converters

| Tool | One-line positioning | Pricing (April 2026) | Source |
| --- | --- | --- | --- |
| **PDF24 Tools** (pdf24.org) | Browser PDF toolbox; added a free X-Rechnung / ZUGFeRD generator and viewer | **Free**, ad-supported, no account | [tools.pdf24.org/de/elektronische-rechnung-erstellen](https://tools.pdf24.org/de/elektronische-rechnung-erstellen) |
| **OpenXRechnungToolbox** (jcthiele) | Java desktop GUI: viewer, validator, Leitweg-ID calculator | **Free, GPL v3** | [github.com/jcthiele/OpenXRechnungToolbox](https://github.com/jcthiele/OpenXRechnungToolbox) |
| **ZUGFeRD-Manager** (OpenIndex) | Open-source desktop creator/validator for ZUGFeRD (also unwraps the embedded XML) | **Free, OSS** | [github.com/OpenIndex/ZUGFeRD-Manager](https://github.com/OpenIndex/ZUGFeRD-Manager) |
| **invoice-portal.de** | Web viewer + KoSIT-grade validator, Peppol receipt | **Receipt plans from €15/mo** (tiered by invoice volume); free validator UI | [invoice-portal.de/prices-receive-e-invoice/](https://invoice-portal.de/prices-receive-e-invoice/) |
| **invoice-converter.com** | "AI" PDF→X-Rechnung conversion + viewer | Subscription, **3-day free trial requires credit card**; tier prices not published on the site | [invoice-converter.com/en](https://www.invoice-converter.com/en) |
| **Perfect E-Rechnung** (Soft-Xpansion, x-re.de) | Windows desktop creator from Excel/Word/PDF; not a viewer | **€36 / year** (subscription) or older v1 at **€49.99 one-off / €19.99 yr**; 14-day trial | [soft-xpansion.de/products/perfect-pdf-12/erechnung/](https://soft-xpansion.de/products/perfect-pdf-12/erechnung/) |
| **EinfachX** (einfach-xrechnung.de) | Hosted X-Rechnung suite: creator, supplier portal, viewer | **Viewer €34.90/yr**; Creator **€12.49 / €29.90 / €84.90 per month** (100 / 300 / 1 000 invoices/yr); Inbound **€13.90 per user/mo**; all + VAT | [einfach-xrechnung.de/en/products/](https://einfach-xrechnung.de/en/products/) |
| **B2Brouter** | Peppol access point + invoice viewer | **Free Basic** (< 10 contacts); **Professional from ~€10/mo**; Enterprise on request | [b2brouter.net/global/prices/](https://www.b2brouter.net/global/prices/) |
| **xrechnung-erstellen.com** | Online generator + PDF→XML helper | **Generator free**; advanced/AI features priced via separate "Preise und Lizenzen" page (no flat list disclosed) | [xrechnung-erstellen.com/preise-und-lizenzen](https://xrechnung-erstellen.com/preise-und-lizenzen) |
| **Markt+Technik eRechnung Viewer** | Windows desktop viewer | **Pricing on request**; sold via mut.de and Amazon | [mut.de/products/erechnung-viewer](https://mut.de/products/erechnung-viewer) |
| **Ultramarin eRechnung Viewer** | Offline-first desktop viewer (privacy angle) | **Pricing on request** | [ultramarinviewer.de](https://www.ultramarinviewer.de/) |

Notes: of the *free* options, none match our scope simultaneously — PDF24 is generator-leaning and ad-supported, the two OSS desktops require Java/JVM installs and ship no XLSX/CSV export, and `invoice-portal.de`'s free surface is the validator, not a multi-format export. The only fully-free, browser-only, DE/EN, multi-format converter we can find is the gap we're filling.

### 8.2 Adjacent — accounting & invoicing SaaS that include X-Rechnung

These don't sell "view this XML" as the product; they bundle X-Rechnung support inside an invoicing/accounting suite. SMEs that already pay one of these will not pay us, but they're also not the audience we're after (recipients without a suite, freelancers, tax advisors who get a one-off XML in the inbox).

| Vendor | Positioning | Pricing tiers (monthly list, € net) | X-Rechnung scope | Source |
| --- | --- | --- | --- | --- |
| **lexoffice / Lexware Office** | Market-leading German SMB cloud accounting (Haufe Group) | **S** (price gated), **M €5.95**, **L €9.95**, **XL €32.90** | Receipt + ZUGFeRD across plans; **full X-Rechnung issuing only on XL** | [lexware.de/preise](https://www.lexware.de/preise/) ([summary](https://trusted.de/lexware-lexoffice-kosten)) |
| **sevDesk** | Cloud accounting + invoicing, X-Rechnung-ready by default | **Free** (3 e-invoices/mo); paid from **€8.90/mo**; full invoicing/accounting tiers ~€12.90 / €25.90 / €34.90 | X-Rechnung + ZUGFeRD send/receive **included in every paid tier**, no surcharge | [sevdesk.de/e-rechnung-software/](https://sevdesk.de/e-rechnung-software/) |
| **easybill** | SMB cloud invoicing, focused on shop / Amazon / DATEV exports | **Free** (50 docs/mo, 3 customers); **Starter**, **Professional from €29/mo (€21 annual)**, **Premium from €35/mo (€30 annual)** | X-Rechnung + ZUGFeRD **in all plans incl. Free** | [easybill.de/en/pricing](https://www.easybill.de/en/pricing) |
| **FastBill** | Cloud invoicing for freelancers and SMBs | **Solo €10 (€9 annual)**, **Plus €15 (€14)**, **Pro €30 (€27)**, **Premium from €59** | X-Rechnung create + receive **in all tiers** | [fastbill.com/preise](https://www.fastbill.com/preise) |
| **Billomat** | Cloud invoicing + expense tracking (Sage) | **From €29/mo** base, up to **€119/mo** enterprise; 14-day trial | X-Rechnung + ZUGFeRD in all paid tiers | [billomat.com/en/pricing/](https://www.billomat.com/en/pricing/) |
| **DATEV E-Rechnungsplattform** | DATEV's national receive/dispatch hub, used by most German tax advisors | **Free until 30 June 2026**. From 1 July 2026: receipt always free; dispatch from non-DATEV systems **€0.50 / outgoing invoice**; optional E-Rechnungsschreibung **€5 / year** | View, archive, dispatch — bundled with the broader DATEV stack | [datev.de — Mitte 2026 release](https://www.datev.de/web/de/berufsgruppenuebergreifend/nachrichten/datev-e-rechnungsplattform-kostenfrei-bis-mitte-2026) |
| **spiketime** | Time-tracking / freelancer billing tool (the original "free e-invoice generator" hook) | E-invoice generator **free**; full SaaS tiers from a few € / user / mo | Generator only; consumes time entries → XRechnung/ZUGFeRD output | [spiketime.de/erechnung-kostenlos-erstellen](https://www.spiketime.de/erechnung-kostenlos-erstellen) |

### 8.3 Enterprise e-invoicing networks (out of scope, listed for completeness)

Pagero (now part of Thomson Reuters), Tradeshift, and Basware all support X-Rechnung as one syntax inside global Peppol/AP platforms. None publish list pricing — quotes are negotiated per buyer/supplier volume and integration. Sources: [pagero.com](https://www.pagero.com/), [tradeshift.com](https://www.tradeshift.com/), [basware.com/en/solutions/e-invoicing-network/](https://www.basware.com/en/solutions/e-invoicing-network/). They don't compete for our user; we mention them so the landscape isn't read as "everything except us is a desktop tool."

### 8.4 Differentiation for v1

The pricing scan tightens, rather than weakens, the case for a free browser converter:

1. **Browser-only privacy** — still the cleanest GDPR story in DACH. Every paid tool above either uploads or installs.
2. **Four downloadable formats from one upload** — PDF24 stops at PDF, the OSS desktops stop at validation/visualization, the SaaS suites assume you live inside their UI. Nobody else gives a tax advisor "drop the XML, get a CSV/XLSX/TXT/PDF, close the tab."
3. **Open source (MIT)** — tax advisors and `Steuerkanzleien` can self-host or vendor-pin; B2Brouter Basic and PDF24 are gratis but closed.
4. **Bilingual DE/EN from day one** — the German-only desktop tools (Perfect E-Rechnung, EinfachX, OpenXRechnungToolbox) leave non-German recipients stranded; the SaaS suites have English UIs but assume you're already a customer.
5. **No account, no email, no trial wall** — invoice-converter.com requires a credit card for its 3-day trial; every SaaS in §8.2 either gates the relevant tier or makes you create a tenant. Our user can finish the job in under a minute.

What we should *not* claim: that we're cheaper than free SaaS tiers (sevDesk, easybill, B2Brouter, DATEV all have one), or that we replace an accounting suite. We replace the *single act* of opening an X-Rechnung you didn't ask for.

## 9. GDPR & privacy

Because all processing happens client-side, we **do not** transmit, store, log, or cache invoice contents on any server. That is the single strongest privacy claim we can make and we should lean on it in copy:

> Ihre Rechnung verlässt Ihren Browser nie. Keine Uploads, keine Server, keine Spuren.

Hosting-level telemetry (Vercel / Plausible) sees page views and timings, not invoice bytes. We'll include a short Privacy page saying exactly this.

## 10. Proposed repo structure

```
x-rechnung-conversion/
├── README.md               ← public-facing project intro (short)
├── PROGRESS.md             ← weekly status, what's done / next
├── LICENSE                 ← MIT
├── docs/
│   ├── RESEARCH.md         ← this file (source of truth)
│   ├── SPEC.md             ← PRD / feature spec (next doc to write)
│   ├── ADR/                ← Architecture Decision Records (one file per decision)
│   └── handoffs/           ← briefs for Claude Code / Codex runs
├── samples/                ← reference X-Rechnung XML files (UBL + CII), anonymised
├── src/
│   ├── app/                ← Next.js App Router pages
│   ├── components/
│   ├── lib/
│   │   ├── parse/          ← UBL + CII parsers → Invoice model
│   │   ├── model/          ← Invoice type + validation
│   │   └── convert/        ← csv / txt / xlsx / pdf generators
│   ├── i18n/               ← de.json, en.json
│   └── styles/
├── public/
├── tests/
│   └── fixtures/           ← parsing test cases
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
└── .github/workflows/      ← lint + test + deploy
```

**Yes, `x-rechnung-conversion/` is the right repo root.** No separate project folder needed. The Cowork workspace already points here; GitHub sync is clean.

## 11. Open questions for Yves

These are the decisions that unblock the implementation brief. Marked with priority.

**P0 — blocks implementation**

1. **PDF fidelity.** Two options:
   a) **Branded / simple layout** — we design a clean invoice look (logo-less, neutral). Faster to build, looks professional, doesn't claim to be "the" X-Rechnung visualisation.
   b) **KoSIT-style official** — port the KoSIT `xrechnung-visualization` XSLT to render the invoice the way German authorities display it. More credible to accounting users, more work, heavier bundle.
   *Claude's suggestion:* start with (a) for v1, add (b) as an optional "offizielle Ansicht" toggle in v1.1.

2. **CSV layout.** Two options:
   a) **Header-only** (one row per invoice) — 30-40 columns, fits a flat import.
   b) **Line-items** (one row per line, header columns repeated) — standard for ERP imports.
   *Claude's suggestion:* offer both via a radio toggle, default to (b).

3. **XLSX layout.** Single flat sheet, or multi-sheet (Overview / Items / Tax)?
   *Claude's suggestion:* multi-sheet — more useful, ExcelJS handles it, negligible extra work.

4. **TXT format.** Is this meant as a human-readable fallback (for people who just want to read it), or a structured export (pipe-delimited / JSON lines for scripts)?
   *Claude's suggestion:* human-readable, German/English depending on UI language. Scripts-users will take the CSV.

**P1 — nice to nail down soon**

5. **Input file types beyond XML:** should we accept **ZUGFeRD/Factur-X PDFs** in v1 (unzip embedded XML), or defer to v1.1?
6. **Version support:** XRechnung 3.0.x only, or also 2.x invoices that businesses may still hold? (Difference is small at the field level; mainly business rules.)
7. **Branding:** do we want a project name beyond "X-Rechnung Converter"? Domain plans?
8. **Licensing:** MIT is the assumed choice. Any reason to go GPL or leave proprietary?

**P2 — after v1**

9. **Batch conversion + zip download** (v1.1).
10. **PWA install** for offline use (trivial once static-exported).
11. **Public API** if we ever want to monetise — Anthropic Claude SDK for optional "explain this invoice" feature?

## 12. Proposed milestones

| Phase | What's done | Gate |
| --- | --- | --- |
| **M0 — Spec** | RESEARCH.md (this doc), SPEC.md with answered open questions | Yves sign-off on both |
| **M1 — Scaffold** | Next.js app, Tailwind, i18n, CI, deployed to preview URL with a placeholder UI | Preview URL opens in DE/EN |
| **M2 — Parser** | UBL + CII parsers → Invoice model; unit tests against 5+ sample XML files | `npm test` green |
| **M3 — Converters** | CSV + TXT + XLSX generators behind a picker | Round-trip test: sample XML → each format → visual/manual review |
| **M4 — PDF** | pdf-lib generator with branded layout | Side-by-side review vs reference invoices |
| **M5 — Polish + launch** | Copy (DE/EN), privacy page, OG image, domain, analytics | Public launch |

Rough effort for a senior dev: **M1-M4 ≈ 2–3 focused weeks**; Claude Code can compress M1-M3 significantly in a well-scoped session.

## 13. Coordination model

- **Cowork (this agent, Claude):** PM/PO. Owns `docs/`, writes briefs, tracks progress, reviews PR descriptions.
- **Claude Code:** implementation. Receives a scoped brief from `docs/handoffs/`, works in the repo directly, runs tests, opens PRs.
- **Codex:** optional, for parallel well-isolated tasks (e.g. "write the CSV generator given this `Invoice` type"). Cowork hands it the exact contract + test fixtures.
- **Claude Chat:** ad-hoc design / copy / research questions that don't need repo access.

The implementation brief that goes to Claude Code will live at `docs/handoffs/01-scaffold.md` (and so on). Every brief ends with a *definition of done* checklist.

---

## References & sources

- **XRechnung standard & KoSIT** — [xeinkauf.de/xrechnung](https://xeinkauf.de/xrechnung/), [XRechnung 3.0.2 release notes](https://www.theinvoicinghub.com/updated-specifications-of-xrechnung-3-0-2-and-xbestellung-1-0/), [itplr-kosit GitHub](https://github.com/itplr-kosit)
- **Official visualization XSLT** — [itplr-kosit/xrechnung-visualization](https://github.com/itplr-kosit/xrechnung-visualization)
- **UBL vs CII overview** — [eu-rechnung.de](https://www.eu-rechnung.de/blog/zugferd-und-xrechnung-ubl-und-cii-als-technische-grundlage-der-e-rechnungsstandards), [mind-forms.de](https://mind-forms.de/e-rechnung/die-sprache-von-zugferd-und-xrechnung-der-unterschied-zwischen-ubl-und-cii/)
- **Related open-source TS library** — [gflohr/e-invoice-eu](https://github.com/gflohr/e-invoice-eu) (generator, not converter, but useful type references)
- **Validation reference (for users)** — [invoice-portal.de XRechnung Validator](https://invoice-portal.de/xrechnung-validator/), [invoicenavigator.eu](https://www.invoicenavigator.eu/validator/xrechnung)
- **Libraries** — [fast-xml-parser](https://www.npmjs.com/package/fast-xml-parser), [ExcelJS](https://github.com/exceljs/exceljs), [pdf-lib](https://pdf-lib.js.org/), [next-intl](https://next-intl-docs.vercel.app/)
- **Competitor scan** — [B2Brouter viewer](https://www.b2brouter.net/de/e-rechnung-viewer/), [invoice-converter.com](https://www.invoice-converter.com/en/xrechnung-validator), [OpenXRechnungToolbox](https://jcthiele.github.io/OpenXRechnungToolbox/), [Perfect E-Rechnung](https://x-re.de/), [spiketime.de](https://www.spiketime.de/blog/e-rechnungen-kostenlos-erstellen)
