# Plainvoice

> Rechnungen im Klartext. · Your X-Rechnung, in plain sight.

A free, privacy-first web tool that converts German **X-Rechnung** XML invoices into **CSV, TXT, XLSX, or PDF** — entirely in your browser. No uploads, no servers, no tracking.

> **Status:** early development. Not yet deployed.

Sibling project to [plain-cards.com](https://plain-cards.com).

## What is an X-Rechnung?

X-Rechnung is the German XML invoice format required for invoices to public authorities (since 2020) and — under the 2025–2028 B2B rollout — for business-to-business invoicing in Germany. It is machine-readable only; humans typically need it converted into something they can read or file.

## Features (planned for v1)

- Drop an X-Rechnung XML (UBL or CII syntax) — detected automatically.
- Convert to **CSV, TXT, XLSX, or PDF** and download.
- German and English UI.
- Runs 100% in your browser. Your invoice never leaves your device.

## Development

See [`docs/RESEARCH.md`](./docs/RESEARCH.md) for the project brief and architecture decisions, [`docs/SPEC.md`](./docs/SPEC.md) for what v1 does, and [`PROGRESS.md`](./PROGRESS.md) for weekly status.

### Prerequisites

- Node.js 22 (see [`.nvmrc`](./.nvmrc))
- [pnpm](https://pnpm.io/) 10+

### Commands

```bash
pnpm install           # install dependencies
pnpm dev               # start dev server at http://localhost:3000
pnpm lint              # next lint
pnpm typecheck         # tsc --noEmit
pnpm test              # vitest run (one-shot)
pnpm test:watch        # vitest watch
pnpm build             # static export to ./out
pnpm format            # prettier --write
```

### Project layout

```
src/
├── app/[locale]/      # App Router pages (de/en)
├── components/        # React components (ui/ for primitives)
├── i18n/              # next-intl config + message catalogs
└── lib/               # parse/, model/, convert/ (populated from M2 on)
```

The app builds as a fully static export (`output: 'export'` in `next.config.ts`) so it can deploy to any static host.

## License

MIT (planned).
