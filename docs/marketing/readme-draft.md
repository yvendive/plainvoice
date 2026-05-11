# Plainvoice

> Rechnungen im Klartext. · Your X-Rechnung, in plain sight.

**Plainvoice** is a free, browser-based converter for German **X-Rechnung** XML invoices. Drop in any X-Rechnung file (UBL or CII syntax, EN 16931-compliant) and convert it to **CSV, TXT, XLSX (Excel), or PDF** — instantly, in your own browser. No upload, no server, no account.

Live at [plainvoice.de](https://plainvoice.de) · Open source under the MIT license.

## Why Plainvoice?

X-Rechnung — Germany's mandatory XML format for invoices to public-sector bodies (since 2020) and B2B partners (rolling out 2025–2028) — is machine-readable but unreadable by humans. Accountants, bookkeepers, Steuerberater, and small business owners regularly receive X-Rechnung files they need to:

- **Read** in a human-friendly layout (PDF)
- **Import** into accounting software (DATEV, Lexware, sevDesk, Buchhaltungsbutler, etc.) via CSV or XLSX
- **Archive** as plain text alongside the XML original

Most existing tools require uploading the invoice to a cloud service. For invoices that often contain sensitive financial detail, that's an unnecessary trust ask. Plainvoice does the conversion **locally in your browser** — the XML never leaves your computer.

## Features

- **Single-file conversion** — drag and drop or pick an XML, choose your output format, download. Free, no account.
- **Bulk conversion (Pro)** — process multiple X-Rechnungs at once and download a ZIP. €39 one-time, no subscription.
- **Format support** — output to CSV (configurable separator, decimal style, encoding), plain text, XLSX, or print-quality PDF.
- **Syntax detection** — UBL and CII profiles auto-detected; no manual selection needed.
- **Bilingual UI** — German and English.
- **Truly local** — XML parsing, mapping, and output generation all run client-side. The server side handles only license issuance and key validation.

## Privacy

The core conversion never sends your invoice anywhere. The browser parses the XML, runs the transformation, and offers the result for download — all on your machine.

**Both free single-file conversion and Pro bulk conversion run entirely in your browser.** The license key is the only piece of paid-customer data we handle server-side, and it's only checked once at activation. After that, key validation is cached and the bulk pipeline runs the same browser-only conversion as the free tier — no invoice data, no XML, no file content ever touches our servers.

The only data we process server-side is the email address and license key for paying customers (delivered via [Resend](https://resend.com), stored in Cloudflare KV). Cloudflare Web Analytics tracks anonymous, cookieless page views so we can see where traffic comes from — no individual session tracking, no fingerprinting.

Full disclosure: see the [Datenschutzerklärung](https://plainvoice.de/de/datenschutz).

## Pricing

- **Free** — single-file conversion. No account, no email, no time limit.
- **Plainvoice Pro** — €39 one-time. Unlocks bulk conversion (multiple files at once → ZIP). Pay via Stripe, receive license key by email, paste it once, done forever. No subscription, no recurring fees.

## Development / contributing

Plainvoice is a [Next.js 15](https://nextjs.org) static-export web app. To work on the code locally:

```bash
git clone https://github.com/yvendive/plainvoice.git
cd plainvoice
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). For production builds, `pnpm build` emits a static export to `./out`.

### Prerequisites

- Node.js 24+
- [pnpm](https://pnpm.io) 10+

### Commands

```bash
pnpm dev          # development server (http://localhost:3000)
pnpm build        # production static export to ./out
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest run
pnpm test:watch   # vitest in watch mode
pnpm format       # prettier --write
```

## Tech stack

- **Frontend**: Next.js 15 (App Router, static export) · TypeScript strict · Tailwind CSS 4 · next-intl (DE/EN)
- **XML parsing**: [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser), with explicit entity-declaration rejection and a 5 MB per-file size cap for security
- **Output**: SheetJS (XLSX), pdf-lib (PDF), custom CSV/TXT renderers
- **License backend**: separate [`plainvoice-pay`](https://github.com/yvendive/plainvoice-pay) repository — Cloudflare Worker (Hono + TypeScript) handling Stripe Checkout, webhook validation, license issuance, and key verification. Persists to Cloudflare KV (LICENSES + PAYMENTS namespaces).
- **Email**: [Resend](https://resend.com) for transactional license delivery
- **Analytics**: Cloudflare Web Analytics (cookieless, EU-friendly)
- **Hosting**: easyname (Austria, EU) for the static frontend via FTPS; Cloudflare Workers for the licensing backend

## Project structure

```
src/
├── app/[locale]/       # Next.js App Router pages (de/en + legal subpages)
├── components/         # React components (Converter, BuyForm, UnlockForm, …)
├── i18n/               # next-intl config + DE/EN message catalogs
└── lib/
    ├── bulk/           # ZIP unpacking + per-file batching for Pro
    ├── convert/        # CSV/TXT/XLSX/PDF rendering pipelines
    ├── invoice/        # XML parsing, UBL/CII detection, schema mapping
    ├── entitlement.ts  # Pro-feature gating (paywall + license check)
    └── seo/            # metadata helpers, JSON-LD schemas
```

The licensing backend lives in a separate repository: [`yvendive/plainvoice-pay`](https://github.com/yvendive/plainvoice-pay).

## Contributing

Issues and pull requests welcome. The codebase is small, well-tested (302 tests at last count), and tries to stay small. Two principles guide changes:

1. **Privacy by default** — the conversion path must remain client-side. Any feature that would require uploading invoice data to a server is out of scope.
2. **DACH-tax legal compliance** — legal text (AGB, Datenschutz, Widerrufsbelehrung) is template-derived from a German legal-text service (currently IT-Recht Kanzlei) and reviewed before merging. Don't edit those copy strings without coordination.

Run `pnpm lint && pnpm typecheck && pnpm test` before opening a PR. CI runs the same.

## Documentation

- [`docs/SPEC.md`](./docs/SPEC.md) — feature scope, format-mapping decisions, edge-case handling.
- [`docs/RESEARCH.md`](./docs/RESEARCH.md) — original project brief, X-Rechnung format research, architecture choices.
- [`AGENTS.md`](./AGENTS.md) — working agreements for AI agents collaborating on this codebase (relevant if you're using Cowork / Claude Code / Codex on a fork).
- [`docs/handoffs/`](./docs/handoffs/) — milestone hand-off briefs documenting how each major phase was scoped and shipped.

## License

MIT. See [`LICENSE`](./LICENSE).

The hosted service at [plainvoice.de](https://plainvoice.de) and the **Plainvoice** trademark are operated by **YS Development B.V.** (Netherlands, KvK 93236867). The MIT license covers the source code; commercial use of the hosted Pro service requires a paid license, and the Plainvoice name remains owned by YS Development B.V.

## About

Built by [Yves Schulz](https://github.com/yvendive) at YS Development B.V. to solve a real problem the author kept hitting: getting an X-Rechnung from a public-sector counterparty and not having a clean, trustworthy way to convert it.

If Plainvoice saves you time, the cheapest way to say thanks is to tell another Steuerberater or bookkeeper about it.

---

*X-Rechnung · ZUGFeRD · EN 16931 · elektronische Rechnung · B2B-Rechnung · CSV · XLSX · PDF · Steuerberater · Buchhaltung · DATEV · Lexware · sevDesk*
