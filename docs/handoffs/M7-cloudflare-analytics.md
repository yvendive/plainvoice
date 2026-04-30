# M7 — Cloudflare Web Analytics integration

**Model:** Claude Sonnet 4.6 — small frontend integration, not security-sensitive (read-only telemetry, no PII, no payment surface). If you started Code on a different tier, run `/model sonnet` before the first commit.

Wire Cloudflare Web Analytics (free, cookieless, no consent banner required under TDDDG) into the Plainvoice frontend. Single PR against `yvendive/plainvoice`, branch `m7-cloudflare-analytics`.

Source artifacts:
- `docs/handoffs/M7-p3-template-driven-revisions.md` — explains why analytics is being added now (Datenschutzerklärung wizard depends on having the analytics tool in scope before generation).
- `AGENTS.md` — standard role boundaries, git hygiene, model rules.
- Cloudflare docs: <https://developers.cloudflare.com/web-analytics/get-started/manual-setup/>

## Yves prerequisite (do BEFORE running the chat prompt)

The beacon token is needed for the JS snippet. Yves's manual steps:

1. Sign into Cloudflare dashboard.
2. Navigate to **Analytics & Logs → Web Analytics**.
3. Click **Add a site**.
4. Enter `plainvoice.de`.
5. Pick **Manual setup** (the domain is hosted at easyname, not Cloudflare-proxied — automatic mode isn't available).
6. Cloudflare displays a JS snippet of the form:
   ```html
   <script defer src='https://static.cloudflareinsights.com/beacon.min.js'
           data-cf-beacon='{"token": "<TOKEN_HERE>"}'></script>
   ```
7. Copy the token (the value inside `data-cf-beacon` JSON).
8. Set the token in TWO places:
   - **Local `.env.local`:**
     ```
     NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN=<TOKEN>
     ```
   - **GitHub Actions secret** (for production builds): repository → Settings → Secrets and variables → Actions → new repository secret named `CLOUDFLARE_ANALYTICS_TOKEN` with the token value. The deploy workflow injects it as `NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` at build time.

If the token isn't set when Code starts, Code stops and asks before proceeding.

## Setup (Code's first actions)

1. `cd ~/Documents/Codex/x-rechnung-conversion`.
2. Read `AGENTS.md`. Per "Handoff briefs" rule #5, commit and push this brief from working tree to `origin/main` before executing (it's untracked when Yves first hands off). Standard procedure: confirm only the brief is pending via `git status --short -- docs/handoffs/M7-cloudflare-analytics.md` and `git status --short` (whole repo); if anything else is dirty, STOP and ask Yves.
3. Confirm `NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` exists in `.env.local`. If absent, STOP and ask Yves.
4. `git checkout main && git pull origin main && git checkout -b m7-cloudflare-analytics`.

## Implementation

One PR, three commits.

### Commit 1 — Add analytics script to root layout

Edit `src/app/[locale]/layout.tsx`:

- Import the token at the top: `const CLOUDFLARE_ANALYTICS_TOKEN = process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN;`.
- Inside the `<html>` element's render, add the script tag conditionally — only render when the token is present, so previews / local builds without a token don't ship a broken beacon:

  ```tsx
  {CLOUDFLARE_ANALYTICS_TOKEN ? (
    <Script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token: CLOUDFLARE_ANALYTICS_TOKEN })}
      strategy="afterInteractive"
    />
  ) : null}
  ```

- Use `next/script` (import `Script from 'next/script'`). For the static export this becomes a plain deferred `<script>` tag in the rendered HTML.

If `next/script` causes hydration issues on the static export, fall back to a plain `<script>` element inside a server component — both behaviors are equivalent for our case. Pick whichever lints + typechecks cleanly.

Commit message: `feat(analytics): wire Cloudflare Web Analytics beacon into root layout`

### Commit 2 — Update CSP to allowlist Cloudflare Insights

Edit `public/.htaccess` — the CSP needs two new sources:

- **`script-src`:** add `https://static.cloudflareinsights.com` (where the beacon JS is served).
- **`connect-src`:** add `https://cloudflareinsights.com` (where the beacon POSTs the page view data).

Updated `Content-Security-Policy` header (full value, drop into the existing line):

```
default-src 'self'; script-src 'self' https://js.stripe.com 'unsafe-inline' https://static.cloudflareinsights.com; frame-src https://js.stripe.com https://hooks.stripe.com; connect-src 'self' https://plainvoice-pay.yvendive.workers.dev https://api.stripe.com https://cloudflareinsights.com; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com
```

Update `docs/security/csp-decisions.md` with a one-paragraph addendum noting the Cloudflare Insights allowlist additions and the rationale (cookieless analytics, EU-acceptable processor, no PII). Reference issue/PR for traceability.

Commit message: `feat(analytics): allowlist Cloudflare Insights endpoints in CSP`

### Commit 3 — Inject token into deploy workflow

Edit `.github/workflows/deploy.yml`:

- In the build step, pass the token as a build-time env var:

  ```yaml
  - name: Build static export
    env:
      NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN: ${{ secrets.CLOUDFLARE_ANALYTICS_TOKEN }}
    run: pnpm build
  ```

- Confirm the existing build step still passes other env vars correctly (don't overwrite the env block; merge in).

Commit message: `ci(analytics): inject Cloudflare Analytics token into production build`

## Hard rules

- **One PR, three commits**, in the order above. Do NOT split into multiple PRs.
- **All three signals green after every commit:** `pnpm lint && pnpm typecheck && pnpm test`.
- **Do not modify** any payment-related code, the entitlement gate, the XML parser, or the Worker repo. Pure analytics integration.
- **Do not push to main.** Push the branch, open the PR, request Yves's review.
- **Do not commit the token** anywhere — it goes in env vars / GitHub Actions secrets only. Even though it's not strictly secret (it's bundled into client JS), keeping it out of repo means we can rotate it without a code change.
- **Do not add automated tests** for the analytics rendering. The script's presence is a build-time concern verified manually post-deploy. A unit test for "is the Script element rendered when env is set" is marginal value vs. complexity cost.

## When done — reply to Yves with

- Branch name + PR URL.
- Output of `pnpm lint && pnpm typecheck && pnpm test`.
- Confirmation that `next/script` was used (or, if you fell back to plain `<script>`, why).
- The exact CSP string committed (paste verbatim so Yves can sanity-check before merge).
- Any deviations from this brief.

## Stop and ask if

- `NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` is missing from `.env.local` — Yves needs to add it before you can verify locally.
- The CSP update breaks anything visible (Stripe Checkout flow, page hydration). Surface the conflict; don't silently relax other CSP directives.
- The deploy workflow already passes env vars in a way that conflicts with the new addition. Surface the conflict and propose how to merge.
- Adding the script causes any CI signal to flip red. Don't push.

## After merge — Yves's verification (post-deploy)

1. Wait for the deploy workflow to finish.
2. Load `https://plainvoice.de/de` with browser devtools open. Network tab should show:
   - `static.cloudflareinsights.com/beacon.min.js` — 200, served as JS.
   - `cloudflareinsights.com/cdn-cgi/rum` — POST, returns 204 or 200, contains the page-view payload.
3. Console tab: no CSP violation errors. If CSP violations appear, paste them to me — we'll tune.
4. After 10–15 minutes, the Cloudflare Web Analytics dashboard at <https://dash.cloudflare.com/?to=/:account/analytics/web-analytics> should show the first page view for `plainvoice.de`. If nothing appears in 30 min, ping me.
5. Once the dashboard shows live data, the prerequisite for the IT-Recht Datenschutzerklärung wizard is complete — Yves can resume that wizard with "Cloudflare Web Analytics" as the analytics tool in scope.
