# M8 perf + a11y wins (PageSpeed Insights follow-up)

**Model:** Claude Sonnet 4.6 — config-and-markup work, no application-logic changes.

**Single-reviewer scope** — per AGENTS.md rule #7, this is below the dual-review threshold (no security/payment/legal/multi-file-refactor). Cowork PM does standard rule-#4 review when the PR lands; no Codex second-pass.

Source: PageSpeed Insights run on 2026-05-05 across DE/EN × mobile/desktop. Top findings:

- Accessibility 94/100 across all four configs (one repeat issue: hidden file input has no associated label).
- Performance: 91 (DE mobile), 78 (EN mobile), 100 (everything else). Asymmetry is small and partly variance — same fixes help both locales.
- Common insights: cache lifetimes, legacy JS, render-blocking requests, forced reflow (parked), unused JS (parked).

## Setup

1. `cd ~/Documents/Codex/x-rechnung-conversion`. Read AGENTS.md.
2. Per Handoff Briefs rule #5, commit and push this brief to `origin/main` first. Standard safety check.
3. `git checkout main && git pull origin main && git checkout -b m8-perf-a11y`.

## Changes — four commits

### Commit 1 — Accessibility: aria-label on file input

The hidden file input in `src/components/FileDropZone.tsx` (used by the converter on `/de` and `/en`) has `class="sr-only"` and no associated `<label>`, which Lighthouse flags. Add `aria-label` so screen readers announce the control correctly.

Fix: in `FileDropZone.tsx`, locate the `<input type="file" class="sr-only" ... />` and add an `aria-label` reading from i18n. Suggested key: `Converter.fileInputLabel`. Wire DE/EN values into `src/i18n/messages/{de,en}.json`:

- DE: `fileInputLabel: "X-Rechnung-Datei auswählen"`
- EN: `fileInputLabel: "Choose X-Rechnung file"`

(Strings differ by language so the i18n parity test passes without allowlisting.)

Commit message: `fix(a11y): add aria-label to hidden file input (Lighthouse #94 fix)`

### Commit 2 — Cache-Control headers in `.htaccess`

The biggest single perf win. PageSpeed flagged 85 KiB savings from missing cache lifetimes. Append to `public/.htaccess` (after the existing `<IfModule mod_headers.c>` block, OR add a new `<IfModule mod_expires.c>` + `<FilesMatch>` block — whichever is cleaner):

```apache
# Long-term cache for hashed/immutable static assets
<IfModule mod_headers.c>
  # Next.js emits hashed filenames (e.g., chunks/579-455ac82.js) — safe to cache forever
  <FilesMatch "\.(js|css|woff2|woff|ttf|otf)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>

  # Images change less often than HTML but more often than hashed assets — 30 days
  <FilesMatch "\.(png|jpg|jpeg|webp|svg|ico)$">
    Header set Cache-Control "public, max-age=2592000"
  </FilesMatch>

  # HTML stays on a short cache so users see new releases quickly
  <FilesMatch "\.html$">
    Header set Cache-Control "public, max-age=300, must-revalidate"
  </FilesMatch>
</IfModule>
```

The `immutable` directive on hashed JS/CSS tells browsers to never revalidate — Next.js's content-hash filenames are immutable by construction.

Verify post-deploy with `curl -I https://plainvoice.de/_next/static/chunks/<some-hashed-file>.js` — should show `cache-control: public, max-age=31536000, immutable`.

Commit message: `perf(deploy): add Cache-Control headers for static assets (PSI: 85 KiB savings)`

### Commit 3 — Tighten browserslist to drop ES5 polyfills

`package.json` likely uses Next.js's default `browserslist` (or omits it, defaulting to a generous list). PageSpeed estimates 12 KiB savings from skipping ES5 polyfills.

Add to `package.json`:

```json
"browserslist": [
  ">=1%",
  "last 2 versions",
  "not dead",
  "not op_mini all",
  "not ie 11",
  "not ie_mob 11"
]
```

This drops IE11 + Opera Mini, which together represent <0.5% of the market and zero of our X-Rechnung-using audience (German accountants on modern Chrome/Edge/Firefox). Safari/Edge/Chrome of recent versions stay covered.

Verify: `pnpm build` and check the produced bundle in `out/_next/static/chunks/` for absence of polyfill chunks (e.g., `polyfills-*.js` should be smaller or absent for evergreen browsers).

Commit message: `perf(build): tighten browserslist to drop ES5 polyfills (PSI: 12 KiB savings)`

### Commit 4 — Preload Inter font

Render-blocking-requests (30ms savings) likely the font load. Add a `<link rel="preload">` for the primary font weight in the root layout (`src/app/layout.tsx`):

```tsx
<head>
  {/* Preload the primary Inter weight so the browser fetches it before
      it hits the CSS that references it. Reduces FCP/LCP delay. */}
  <link
    rel="preload"
    href="/fonts/Inter-Regular.ttf"
    as="font"
    type="font/ttf"
    crossOrigin="anonymous"
  />
</head>
```

Confirm the path matches our actual font file (the pentest report verified self-hosted `public/fonts/Inter-Regular.ttf`). If we have additional weights actively used in critical above-the-fold text (e.g., 600/700 for headings), preload those too — but conservatively, start with just Regular and re-measure.

Commit message: `perf(font): preload Inter-Regular for faster FCP (PSI: render-blocking)`

## Hard rules

- **One PR, four commits**, in the order above. Each commit message references the PSI metric it addresses.
- `pnpm lint && pnpm typecheck && pnpm test` after every commit.
- The i18n parity test still passes after Commit 1 (DE/EN values for `fileInputLabel` are different strings).
- No application logic touched. No changes to the converter, parsers, or paywall code.

## Parked findings (NOT in this PR)

These are the bigger PSI items we deliberately don't tackle in this round:

- **Forced reflow + 4 long main-thread tasks (1.3s total Script Evaluation):** the Next.js client-side React bundles for the Converter component. Browser-only conversion is the value proposition; we can't ship "less JS" without losing functionality. Real wins here would require code-splitting the Converter into a lazy-loaded chunk that doesn't load on first paint — restructuring work, not a config tweak. Park for M9 if traffic data justifies the effort.
- **Reduce unused JavaScript (46 KiB):** same root cause, same answer. Park.
- **Network dependency tree:** chained requests for Next.js framework chunks. Architectural; park.

If the perf score after Commits 1-4 still doesn't satisfy stakeholder threshold, raise it post-launch and we revisit the parked items as a dedicated optimization sprint.

## When done

Reply to Yves with branch + PR URL + lint/typecheck/test output + the rendered `.htaccess` diff (paste the new block verbatim so Cowork PM can sanity-check before merge).

Post-merge, Yves runs PageSpeed Insights again and shares the score deltas.
