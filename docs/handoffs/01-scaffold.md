# Handoff 01 — Scaffold the Plainvoice app (M1)

**To:** Claude Code
**From:** Cowork (Claude, acting as PM/PO)
**Product name:** Plainvoice (sibling to plain-cards.com). Taglines: DE "Rechnungen im Klartext." / EN "Your X-Rechnung, in plain sight."
**Scope:** M1 only — project skeleton, tooling, CI, preview deploy. **No parsers, no converters, no UI polish.** Just a working shell.
**Prereqs:** `docs/RESEARCH.md` and `docs/SPEC.md` read.
**Estimated effort:** 1–3 hours for a focused session.

---

## 1. What you're building

A Next.js 15 + TypeScript app in this repo's root, with Tailwind, shadcn/ui, `next-intl` for DE/EN, and a placeholder landing page. Deployable as a static export. Lint + test + build green in CI. Preview URL on Vercel.

The app does **nothing functional yet**. The landing page shows the file-drop UI (non-functional), the language toggle (functional), and a footer with "Datenschutz" / "Privacy" link to a stub page.

## 2. Folder structure to create

Create exactly this layout (some folders will stay empty, that's fine — add a `.gitkeep`):

```
x-rechnung-conversion/
├── README.md              ← exists, keep
├── PROGRESS.md            ← exists, keep
├── LICENSE                ← add: MIT, year 2026, copyright "Yves / plain-cards.com"
├── .gitignore
├── .editorconfig
├── .nvmrc                 ← lock Node version (LTS, currently 22)
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── vitest.config.ts
├── eslint.config.mjs
├── .prettierrc
├── docs/                  ← exists, keep
├── samples/               ← exists, keep; add .gitkeep
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx            ← landing (placeholder drop zone)
│   │   │   └── datenschutz/
│   │   │       └── page.tsx        ← privacy stub (bilingual)
│   │   ├── globals.css
│   │   └── favicon.ico
│   ├── components/
│   │   ├── ui/                     ← shadcn/ui components land here
│   │   ├── FileDropZone.tsx        ← stub, visual only
│   │   └── LanguageToggle.tsx      ← functional
│   ├── lib/
│   │   ├── parse/                  ← empty, add .gitkeep
│   │   ├── model/                  ← empty, add .gitkeep
│   │   └── convert/                ← empty, add .gitkeep
│   ├── i18n/
│   │   ├── config.ts
│   │   ├── request.ts
│   │   └── messages/
│   │       ├── de.json
│   │       └── en.json
│   └── styles/                     ← if needed for Tailwind config helpers
├── public/
│   ├── robots.txt
│   └── og.png              ← placeholder 1200x630, solid colour is fine
├── tests/
│   └── fixtures/.gitkeep
└── .github/
    └── workflows/
        ├── ci.yml                  ← lint + typecheck + test + build
        └── preview.yml             ← Vercel preview (if using Vercel Actions)
```

## 3. Technology & dependency choices (do not substitute without flagging)

Rationale lives in `docs/RESEARCH.md` §7.

- Next.js 15 (App Router), React 19, TypeScript 5.x, strict mode on.
- Tailwind CSS 4 + `shadcn/ui` (copy-in components — only install `button`, `radio-group`, `alert`, `card` for M1).
- `next-intl` 3.x for i18n. DE default, EN alternative. Detection order: `localStorage` (key `xrc.lang`) → `Accept-Language` → DE.
- `vitest` + `@testing-library/react` for tests (we'll use it heavily from M2 onward; for M1 just include one smoke test).
- `eslint` (flat config) + `prettier` + `typescript-eslint`.
- **Do NOT install** `fast-xml-parser`, `exceljs`, `pdf-lib`, or `@pdf-lib/fontkit` yet — those come in M2/M3/M4.

## 4. Specific implementation notes

### 4.1 Landing page (`src/app/[locale]/page.tsx`)

- Centered column, max-width ~640 px.
- Headline (from i18n messages): `App.title` → "Plainvoice" (same in DE and EN).
- Tagline under headline: `App.tagline` → DE: "Rechnungen im Klartext.", EN: "Your X-Rechnung, in plain sight."
- Subhead: `Converter.subtitle` → DE: "Konvertieren Sie Ihre X-Rechnung in CSV, TXT, XLSX oder PDF — direkt in Ihrem Browser.", EN: "Convert your X-Rechnung to CSV, TXT, XLSX, or PDF — right in your browser."
- `<FileDropZone>` — dashed border, drag-and-drop **visual only** (do not wire up actual file parsing yet). Clicking should open the file picker; selecting a file simply logs to console for now and shows a "Coming soon" toast.
- Privacy one-liner below: `Converter.privacy` → DE: "Ihre Rechnung verlässt Ihren Browser nie.", EN: "Your invoice never leaves your browser."
- Footer with language toggle + link to `/datenschutz`.

### 4.2 Language toggle (`src/components/LanguageToggle.tsx`)

- Two buttons "DE | EN" in the header.
- Clicking writes to `localStorage` key `xrc.lang` and navigates to the equivalent locale route.
- Uses `next-intl`'s `useLocale()` + `usePathname()` + `useRouter()`.

### 4.3 Privacy stub (`/datenschutz`)

- Short bilingual page (content switches with locale).
- Placeholder text: "Diese Anwendung verarbeitet Ihre Rechnung ausschließlich lokal in Ihrem Browser. Es werden keine Inhalte an Server übertragen." + EN equivalent.
- Final polished copy comes later at M5; this is a stub so the footer link isn't broken.

### 4.4 CI (`.github/workflows/ci.yml`)

Run on every push and PR:

```
- pnpm install --frozen-lockfile   (use pnpm — lighter + faster)
- pnpm lint
- pnpm typecheck                   (tsc --noEmit)
- pnpm test                         (vitest run)
- pnpm build                        (next build)
```

Fail fast. Matrix on Node 22.

### 4.5 Hosting — easyname (prod) + Vercel (preview)

**Production target: easyname Large Hosting** (Yves' existing vhost). This is shared PHP-style hosting — no Node.js runtime — so the app MUST build as a static export.

- Configure `next.config.ts` with `output: 'export'` from the start. No server components that require a Node runtime at request time; static server components are fine.
- `pnpm build` must produce a `out/` folder of plain HTML/CSS/JS that can be served by any static host.
- Add a GitHub Actions workflow `.github/workflows/deploy.yml` that, on push to `main`:
  1. runs the build,
  2. uploads `out/` to easyname via **SFTP** (use `SamKirkland/FTP-Deploy-Action` or equivalent),
  3. uses repo secrets `EASYNAME_HOST`, `EASYNAME_USER`, `EASYNAME_PASSWORD`, `EASYNAME_REMOTE_PATH` — do NOT hard-code anything.
- Do not set up the production workflow yet if Yves hasn't provided the domain + SFTP credentials. Leave the workflow file with placeholder values and a big `# TODO: populate secrets` comment so it's obvious.

**Preview deploys: Vercel free tier.** Link the repo to Vercel manually. Every PR gets a `*.vercel.app` preview URL. Not for production traffic, just so we (and Yves) can click through WIP PRs.

**Don't break portability.** Because we build as a static export, the app will also deploy cleanly to Netlify / Cloudflare Pages / GitHub Pages if we ever move — keep it that way (no server actions, no Node-only APIs on routes).

### 4.6 README & PROGRESS

- Leave `README.md` as-is; you can add a short **Development** section at the bottom with the standard commands (`pnpm dev`, `pnpm test`, `pnpm build`).
- Append a new entry to `PROGRESS.md` dated to the day you do the work, summarising what landed.

## 5. Definition of done

- [ ] All files and folders above exist in the repo.
- [ ] `pnpm install && pnpm dev` boots to `http://localhost:3000` and renders the DE landing page.
- [ ] Language toggle switches to EN and back, persists through refresh.
- [ ] Drop zone visual renders; click-to-browse opens native file picker; selecting a file shows a toast "Coming soon" (no error).
- [ ] `/datenschutz` renders bilingual stub text.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass locally.
- [ ] CI workflow green on a PR.
- [ ] Preview URL on Vercel loads the page from the main branch.
- [ ] `PROGRESS.md` updated with the M1 entry.
- [ ] Commit history is tidy (small logical commits, not one mega-commit). No secrets committed.

## 6. Things to ask Cowork (me) before doing

- Domain to use for production (candidates: `plainvoice.de`, `plainvoice.app`, `plainvoice.io`, `plainvoice.com` — Yves to confirm which he registers).
- easyname SFTP credentials + target remote path (store as GitHub Actions secrets; never commit).
- Anything unclear in the SPEC — especially acceptance tests for the drop-zone stub.

## 7. Explicitly out of scope for this handoff

- Parsing anything (M2).
- Generating any output (M3/M4).
- shadcn theming beyond defaults.
- SEO copy, OG image final art, analytics.
- Tests for parsers (there's nothing to test yet).

Next handoff (`02-parser.md`) will specify the UBL + CII parsers and the `Invoice` TypeScript model. I'll write that after this brief returns a working preview URL.
