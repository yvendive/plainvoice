# M7 pre-launch — Frontend security hardening (PR-1)

**Model:** Claude Opus 4.6 — work touches the paywall gate, the XML parser (a primary attack surface), and the production HTTP-header surface. Security-sensitive bundle warrants the top tier. If you started Code on Sonnet, switch via `/model opus` before the first commit.

Three frontend security fixes from the 2026-04-29 pre-launch pentest review. All three are launch-blockers; ship as one PR against `yvendive/plainvoice`.

Source artifacts:
- [`../security/pentest-report-2026-04-29.md`](../security/pentest-report-2026-04-29.md) — full audit report.
- [`../security/pentest-issues-2026-04-29.md`](../security/pentest-issues-2026-04-29.md) — triage doc with issue specs and CSP wording.
- GitHub issues to close: `yvendive/plainvoice#16`, `#17`, `#18`. Read each issue body before starting the corresponding fix — issue bodies contain the full acceptance criteria; this brief is the implementation order, bundling rules, and clarifications.

## Setup

1. `cd ~/Documents/Codex/x-rechnung-conversion`.
2. Read `AGENTS.md` from the same repo. The "Handoff briefs", "Model selection", "Code review verification", and "Git hygiene" sections all apply.
3. `gh issue view 16 --repo yvendive/plainvoice` (and 17, 18). Read all three before writing code.
4. `git checkout main && git pull origin main`.
5. `git checkout -b m7-prelaunch-frontend-hardening`.

## Implementation order

Critical first, then High, then the deploy-config Medium. Run `pnpm test` and `pnpm typecheck` and `pnpm lint` after each commit — three CI signals, not just tests. PR-2's CI miss came from skipping lint locally.

### 1. `#16` — `?pro=1` URL override bypass

In `src/lib/entitlement.ts`, gate the URL override on the live-mode flag. The flag must be evaluated INSIDE the function (not as a module-top-level const captured at import time) so test environments can flip it per test without re-importing the module — but if your test framework supports `vi.stubEnv()` to set `NEXT_PUBLIC_PAYWALL_LIVE` before module evaluation, the module-top-level pattern is fine. Pick whichever makes the tests cleanest.

Suggested shape (module-top-level pattern):

```ts
const PAYWALL_LIVE = process.env.NEXT_PUBLIC_PAYWALL_LIVE === 'true';

export function isPro(): boolean {
  if (typeof window === 'undefined') return false;
  if (!PAYWALL_LIVE) {
    const params = new URLSearchParams(window.location.search);
    if (params.get(URL_OVERRIDE) === '1') {
      try {
        localStorage.setItem(KEY, '1');
      } catch {
        /* ignore quota / privacy mode */
      }
      return true;
    }
  }
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
```

**Critical extra step:** before committing, grep the codebase for OTHER paywall-bypass paths that may exist outside `isPro()`. Search at minimum for: `URL_OVERRIDE`, `?pro=`, `'pro'`, `plainvoice.pro`, `localStorage.setItem.*pro`, `lockPro`. If any other code path also writes the entitlement based on URL params or grants Pro state without going through `isPro()`, gate that path on `PAYWALL_LIVE` too. This was the M7 P2 review miss — a single point-fix isn't enough.

Tests in `src/lib/__tests__/entitlement.test.ts` (or wherever existing entitlement tests live; create the file if absent):
- `?pro=1` with `PAYWALL_LIVE=true` → `isPro()` returns `false`, NO write to localStorage.
- `?pro=1` with `PAYWALL_LIVE=false` (or unset) → `isPro()` returns `true`, localStorage write.
- localStorage already has `plainvoice.pro=1` and no `?pro` param → `isPro()` returns `true` regardless of flag (existing customers stay unlocked after P4 flip).
- `lockPro()` clears both keys regardless of flag state.

Commit message: `fix: gate ?pro=1 URL override on NEXT_PUBLIC_PAYWALL_LIVE (#16)`

### 2. `#17` — XML parser hardening

Three sub-changes, one commit.

**a. Disable entity processing.** In `src/lib/invoice/parsers/shared.ts` (or wherever fast-xml-parser is configured), set `processEntities: false`. X-Rechnung XML doesn't use entity references — this is safe to disable. Verify by reading existing parser tests; they should all still pass.

**b. Pre-flight `<!DOCTYPE` / `<!ENTITY` rejection.** Before handing the raw XML string to fast-xml-parser, scan for these declarations and reject early. A simple approach:

```ts
const PROHIBITED_XML_DECLARATIONS = /<!(DOCTYPE|ENTITY)\b/i;

export function rejectsEntityDeclarations(xml: string): boolean {
  // Only check the prologue — entity declarations are illegal after the root
  // element starts, and scanning the full body wastes cycles on legitimate
  // large invoices.
  const prologue = xml.slice(0, 4096);
  return PROHIBITED_XML_DECLARATIONS.test(prologue);
}
```

Wire this into the parser entry point before the actual parse call. Throw a descriptive error so the converter UI can surface it.

**c. Per-file size cap.** Add a constant `MAX_XML_FILE_BYTES = 5 * 1024 * 1024` (5 MB) in `src/lib/invoice/index.ts` (or a new `src/lib/invoice/limits.ts` if cleaner). Enforce it in two places:

- `src/components/Converter.tsx` — single-file flow, check `file.size` BEFORE `file.text()`.
- `src/lib/bulk/collect.ts` — bulk flow, check each file individually before collecting bytes.

The existing 100 MB total bulk limit stays. The new 5 MB per-file limit is layered on top.

**UI error strings.** Three new translation keys in `src/i18n/messages/de.json` and `src/i18n/messages/en.json`:
- `Errors.fileTooLarge` — "Datei zu groß" / "File too large"
- `Errors.xmlEntityDeclarationsForbidden` — "XML mit Entity-Deklarationen wird aus Sicherheitsgründen abgelehnt." / "XML with entity declarations is rejected for security reasons."
- `Errors.xmlSizeLimit` — copy mentioning the 5 MB limit explicitly

Verify the i18n parity test (`tests/i18n/de-translation-coverage.test.ts`) still passes — DE and EN values must differ unless allowlisted.

Tests:
- Fixture: small valid X-Rechnung CII XML → parses normally.
- Fixture: XML with `<!ENTITY foo "bar">` declaration → rejected with `Errors.xmlEntityDeclarationsForbidden`.
- Fixture: XML with `<!DOCTYPE root SYSTEM "evil.dtd">` → rejected.
- Fixture: 5.1 MB XML → rejected with `Errors.fileTooLarge` BEFORE `file.text()` runs (assert `text()` mock not called).
- Fixture: 4.9 MB valid XML → parses normally (boundary test).

Commit message: `fix: harden XML parser — disable entities, reject declarations, per-file size cap (#17)`

### 3. `#18` — Static-site security headers via `.htaccess`

Add `public/.htaccess` (Next.js copies `public/*` to `out/` during `next build`, so it ships with the static export). Use the exact CSP from the issue body — re-verified below for clarity:

```apache
<IfModule mod_headers.c>
  Header always set Content-Security-Policy "default-src 'self'; script-src 'self' https://js.stripe.com 'unsafe-inline'; frame-src https://js.stripe.com https://hooks.stripe.com; connect-src 'self' https://plainvoice-pay.yvendive.workers.dev https://api.stripe.com; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com"
  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
  Header always set X-Frame-Options "DENY"
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), interest-cohort=()"
</IfModule>
```

**Trade-off to document.** `'unsafe-inline'` on `script-src` is required because Next.js's hydration emits inline `<script>` tags for the React state bootstrap; without it, the static export won't hydrate and the converter will be broken. Same for `style-src` — Tailwind's runtime utilities and shadcn-style component variants emit inline `<style>` tags. The strict-CSP alternative (per-render nonces or `'strict-dynamic'`) requires server-side render orchestration we don't have on a static export.

Add `docs/security/csp-decisions.md` documenting:
- Why `'unsafe-inline'` is accepted for `script-src` and `style-src` in v1.
- The upgrade path: revisit when we either (a) switch to a dynamic-rendered host or (b) configure a build-time CSP-nonce plugin.
- The upgrade path is post-launch; not a launch-blocker.

**Verify the deploy workflow ships `.htaccess`.** Look at `.github/workflows/deploy.yml` — confirm it uploads the entire `out/` directory via FTPS to easyname. If the FTPS step uses an explicit allowlist of file types (e.g., `*.html *.js *.css`), `.htaccess` will be skipped. Update to upload everything in `out/`. If the deploy step is `lftp mirror`, dotfiles are usually skipped by default — add `--include-glob '.*'` or equivalent.

No test required (config file). Manual verification post-deploy:

```bash
curl -I https://plainvoice.de/de
```

Should return all headers. Then submit the URL to `https://securityheaders.com` — target grade: A or A+.

Commit message: `fix: add CSP and security headers via public/.htaccess (#18)`

## Hard rules

- **One PR, one branch** (`m7-prelaunch-frontend-hardening`). Do NOT split into three PRs.
- **One commit per fix**, in the order above. Three commits before push. Each commit message ends with `Closes #<num>` so GitHub auto-links and auto-closes on merge.
- **All three signals green after every commit:** `pnpm lint && pnpm typecheck && pnpm test`. Don't push if any is red.
- **Do not modify files outside** `src/`, `tests/`, `public/`, `docs/security/`, and `.github/workflows/deploy.yml` (only if FTPS allowlist needs updating). If a fix needs adjacent docs or i18n changes, those are in scope.
- **Do not change** the existing X-Rechnung parsing logic, the CSV/TXT/XLSX/PDF converter logic, or the i18n parity test invariant. Only ADD entries to `de.json` / `en.json` for the new error keys.
- **Do not run** `pnpm audit fix` or `pnpm update`. Frontend dep upgrades are a separate post-launch PR (`yvendive/plainvoice#21`).
- **Do not push to main.** Push the branch, open the PR, link the three issues, request Yves's review.
- **The `?pro=1` override must continue to work** in dev/preview (where `NEXT_PUBLIC_PAYWALL_LIVE` is unset or `false`). Yves's QA workflow depends on this.

## PR body template

```markdown
## What

Bundle of three frontend security fixes from the 2026-04-29 pre-launch pentest review.

Closes:
- yvendive/plainvoice#16 — Critical: ?pro=1 URL override bypass
- yvendive/plainvoice#17 — High: XML parser hardening (entities + size cap)
- yvendive/plainvoice#18 — Medium: static-site security headers via .htaccess

## How

[one paragraph per fix; reference each issue's checklist]

## Test plan

- [ ] `pnpm lint` — green
- [ ] `pnpm typecheck` — green
- [ ] `pnpm test` — all green (including i18n parity test)
- [ ] Manual: `?pro=1` works on local dev (`NEXT_PUBLIC_PAYWALL_LIVE=false`)
- [ ] Manual: `?pro=1` no-op when test-flipping `NEXT_PUBLIC_PAYWALL_LIVE=true`
- [ ] Manual: 6 MB XML upload rejected with the size error
- [ ] Manual: XML with `<!ENTITY>` declaration rejected
- [ ] Post-deploy: `curl -I https://plainvoice.de/de` shows all headers (Yves runs after merge)
- [ ] Post-deploy: securityheaders.com returns A or A+ (Yves runs after merge)

## Out of scope

- Frontend dep upgrades (yvendive/plainvoice#21 — separate PR post-launch)
- Privacy text accuracy (yvendive/plainvoice#19 — folds into P3b template-driven revisions)
- DE-only legal page routing (P3c — separate workstream after IT-Recht templates arrive)
```

## When done — reply to Yves with

- Branch name + PR URL.
- Output of `pnpm lint && pnpm typecheck && pnpm test` (concatenated, full pass/fail counts).
- Confirmation that grep for OTHER paywall-bypass paths returned no additional sites needing the gate (or, if any were found, what was changed).
- The exact CSP string committed in `public/.htaccess` (paste it back so Yves and Cowork PM can sanity-check before merge).
- Any deviations from this brief, with rationale.

## Stop and ask if

- The CSP causes Stripe Checkout to break in test (e.g., `connect-src` blocks the redirect, or a hash-mismatch on Stripe's inline script). Don't relax `'unsafe-inline'` further without telling Yves; instead surface the conflict and propose options.
- The i18n parity test fires on the new error strings (e.g., DE and EN happen to share a word). Add a one-line allowlist entry with rationale rather than rewording one side to break the parity intentionally.
- Any of the three fixes' tests reveal an unrelated bug. File a follow-up issue, mention in PR body, do NOT expand this PR's scope.
- The FTPS deploy step is structured in a way where uploading `.htaccess` requires non-trivial workflow changes. Surface the conflict; it's possible we need a one-off manual upload of `.htaccess` for v1.
