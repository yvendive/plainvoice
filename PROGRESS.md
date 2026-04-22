# Progress Log

Session-level status for the Plainvoice project. For the "why" behind decisions, see `docs/RESEARCH.md`. For the "what", see `docs/SPEC.md`.

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
