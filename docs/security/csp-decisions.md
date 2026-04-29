# Content-Security-Policy decisions — Plainvoice (frontend)

This document records the v1 CSP shipped in `public/.htaccess`, the
trade-offs accepted, and the upgrade path. It accompanies issue
[`yvendive/plainvoice#18`](https://github.com/yvendive/plainvoice/issues/18)
and the 2026-04-29 pre-launch pentest.

## v1 policy (the one in `public/.htaccess`)

```
default-src 'self';
script-src 'self' https://js.stripe.com 'unsafe-inline';
frame-src https://js.stripe.com https://hooks.stripe.com;
connect-src 'self' https://plainvoice-pay.yvendive.workers.dev https://api.stripe.com;
img-src 'self' data:;
font-src 'self';
style-src 'self' 'unsafe-inline';
frame-ancestors 'none';
base-uri 'self';
form-action 'self' https://checkout.stripe.com
```

## Why each directive looks like that

- **`default-src 'self'`** — anything not overridden falls back to same-origin
  only. `media-src`, `object-src`, `worker-src`, `manifest-src` inherit this.
- **`script-src 'self' https://js.stripe.com 'unsafe-inline'`** — Stripe
  Checkout's redirect path injects `js.stripe.com/v3` so we must allow it.
  See `unsafe-inline` discussion below.
- **`frame-src https://js.stripe.com https://hooks.stripe.com`** — Stripe
  embeds an iframe at `js.stripe.com` for 3DS / SCA challenges and at
  `hooks.stripe.com` for some redirect flows.
- **`connect-src 'self' https://plainvoice-pay.yvendive.workers.dev
  https://api.stripe.com`** — the frontend talks to our Worker for
  `/api/checkout` and `/api/verify`; Stripe.js calls `api.stripe.com` for
  payment-method tokenization.
- **`img-src 'self' data:`** — Tailwind / shadcn occasionally inline tiny
  PNG dataURLs for dividers / loading shimmers; we don't load images from
  any other origin.
- **`font-src 'self'`** — fonts ship from `public/fonts/` (self-hosted).
- **`style-src 'self' 'unsafe-inline'`** — Tailwind utilities and the
  shadcn-style component variants emit inline `<style>` tags during
  hydration. See `unsafe-inline` discussion below.
- **`frame-ancestors 'none'`** — prevents click-jacking of the buy/unlock
  UI; doubles up with the `X-Frame-Options: DENY` header for older browsers.
- **`base-uri 'self'`** — defeats `<base href="https://evil/">` injection
  if a future XSS lands.
- **`form-action 'self' https://checkout.stripe.com`** — the only
  cross-origin POST target is Stripe Checkout's hosted form.

## The `'unsafe-inline'` trade-off

Both `script-src` and `style-src` carry `'unsafe-inline'`. This is the
biggest weakness in the v1 policy and is **deliberately accepted** for
launch. Here is why:

### `script-src 'unsafe-inline'`

Next.js 15 emits inline `<script>` tags for the React state bootstrap on
every page (`__NEXT_DATA__` and the small inline runtime that hydrates
the static HTML). Without `'unsafe-inline'`, the static export will not
hydrate and the converter will be visibly broken in the browser
(buttons unresponsive, no client-side state).

The strict-CSP alternatives all require server-side render orchestration
that we don't currently have:

- **Per-render nonces (`'nonce-…'`)** — Next.js's `headers()` config
  doesn't apply to `output: 'export'`. Generating a per-request nonce
  requires either (a) moving off the static export to a dynamic host or
  (b) a custom build-time CSP-nonce plugin that rewrites every emitted
  inline `<script>` with a known nonce, plus a runtime layer that matches
  it on header emit. Both are doable; neither fits the launch window.
- **`'strict-dynamic'`** — only works if all script loads chain from a
  trusted nonce or hash; it does not relax the inline-script restriction
  on its own.
- **Per-script `'sha256-…'` hashes** — the inline scripts Next.js emits
  vary per build (and sometimes per request); maintaining the hash list
  manually is brittle.

### `style-src 'unsafe-inline'`

Tailwind class collisions and shadcn-style component variants often produce
inline `<style>` blocks at hydration time, especially for dynamic theme
switches (the locale-driven layout). The same alternatives apply, with the
same conclusion: not worth the launch risk.

## Upgrade path (post-launch)

Revisit when **either** of the following lands:

1. We move off the easyname static export to a dynamic-rendered host
   (Vercel, Cloudflare Pages with Workers, etc.). At that point, Next.js's
   built-in nonce support can be enabled via `headers()` and `'unsafe-inline'`
   removed from both directives.
2. We adopt a build-time CSP-nonce plugin that rewrites the emitted HTML to
   inject nonces; combined with a per-request header from a CDN edge or
   `.htaccess` `mod_rewrite` rule that attaches the matching nonce, this
   would also let us drop `'unsafe-inline'`.

Neither is a launch blocker. Track follow-up in a post-launch issue once we
have v1 traffic data telling us whether dynamic hosting is justified.

## Other security headers shipped alongside the CSP

- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — one
  year, no `preload` (we'd need to opt in via `hstspreload.org` first).
- `X-Frame-Options: DENY` — legacy browser sibling of `frame-ancestors 'none'`.
- `X-Content-Type-Options: nosniff` — defeats MIME sniffing.
- `Referrer-Policy: strict-origin-when-cross-origin` — same-origin keeps
  full URL; cross-origin sees only the origin; downgrades omit referrer.
- `Permissions-Policy: camera=(), microphone=(), geolocation=(),
  interest-cohort=()` — Plainvoice never asks for any of these; the empty
  allowlist locks them out for embedded contexts and disables FLoC.

## Verification checklist (post-deploy)

After the next deploy lands on plainvoice.de:

```bash
curl -sI https://plainvoice.de/de \
  | grep -iE 'content-security-policy|strict-transport|x-frame|x-content-type|referrer-policy|permissions-policy'
```

Then submit `https://plainvoice.de/de` to:

- `https://securityheaders.com` — target grade **A** or **A+**.
  (Won't reach A+ while `'unsafe-inline'` is present; A is acceptable for v1.)
- Stripe Checkout end-to-end click-through — confirm the redirect to
  `checkout.stripe.com` and the return to `/{locale}/unlocked` both work.
  If the CSP blocks anything, the browser console will say so explicitly;
  do not relax `'unsafe-inline'` further without re-running this checklist.
