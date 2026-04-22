# Progress Log

Session-level status for the Plainvoice project. For the "why" behind decisions, see `docs/RESEARCH.md`. For the "what", see `docs/SPEC.md`.

## 2026-04-21 — Kickoff + spec + brand

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
