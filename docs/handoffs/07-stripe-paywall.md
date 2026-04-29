# M7 — Stripe paywall + license delivery

Convert the scaffolded `ProGate` (M6) into a live revenue path. Customers pay €39 one-time → receive a license key by email → unlock bulk conversion. The frontend stays static; a thin serverless backend handles Stripe + key issuance + email.

This milestone is **not a single Code session**. It's phased: Phase 1 backend, Phase 2 frontend, Phase 3 legal, then soft launch with test cards. Each phase ships behind a feature flag (env-var controlled) so we don't expose half-built flows.

## 0. Decisions to confirm before kickoff

These choices are picked for cost, EU compliance, and time-to-launch. Push back on any of them and we re-scope before Code starts.

| Choice | Recommendation | Why |
| --- | --- | --- |
| Payment provider | **Stripe** | Already locked in M6. Best DACH/EU coverage, supports SEPA, Apple Pay, cards. |
| Pricing | **€39 one-time, EUR only, gross (incl. VAT)** | Anchor from M6 ProGate copy. EUR-only avoids FX complexity. |
| Backend host | **Cloudflare Workers + KV** | Free tier covers years of volume. EU regions. No cold-start issue. Stays the lightest possible "is there a backend?" answer. |
| Email delivery | **Resend** | 3k/month free transactional. Clean DX. Can switch to Postmark later. |
| License key format | **22-char URL-safe random token (~128-bit)** | Pasteable, single-line, no ambiguity. Generated server-side. |
| Storage | **Cloudflare KV (two namespaces)** | Free tier: 1k writes/day, 100k reads/day. Plenty for v1. |
| Repo split | **NEW repo `plainvoice-pay`** for the Worker, plainvoice frontend stays as-is | Keeps the static site reviewable in isolation; Worker has its own CI + secrets surface. |
| VAT handling | **Stripe Tax + NL OSS registration** | OSS lets a Dutch BV charge German VAT without DE tax registration. Stripe Tax computes per-customer. |
| Refund policy | **14-day right of withdrawal unless explicitly waived at checkout** (per AGB §6) | The waiver checkbox is the legal pivot — see Phase 3. |

## 1. Architecture (text diagram)

```
┌──────────────────────────────────────────────────────────────┐
│  plainvoice.de (static, easyname, FTPS deploy)               │
│  ├─ /[locale]            ← existing landing                  │
│  ├─ /[locale]/buy        ← NEW: price + waiver checkbox      │
│  ├─ /[locale]/unlock     ← NEW: paste license, verify        │
│  └─ /[locale]/unlocked   ← NEW: post-Stripe success page     │
└────────────────────────────┬─────────────────────────────────┘
                             │ HTTPS (CORS-restricted)
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  plainvoice-pay (Cloudflare Worker)                          │
│  ├─ POST /api/checkout   ← creates Stripe Checkout Session   │
│  ├─ POST /api/webhook    ← receives Stripe events            │
│  └─ POST /api/verify     ← validates a license key           │
│                                                              │
│  KV namespaces:                                              │
│  ├─ LICENSES   key=<license_key>     value=<LicenseRecord>   │
│  └─ PAYMENTS   key=<stripe_pi_id>    value=<license_key>     │
└─────┬────────────────────────────────────────────┬───────────┘
      │                                            │
      ▼                                            ▼
   Stripe                                       Resend
   (Checkout +                                  (license email,
    Tax + Webhook)                               receipt copy)
```

## 2. Phasing

| Phase | Owner | Output | Acceptance signal |
| --- | --- | --- | --- |
| P1 — Worker backend | Code | `plainvoice-pay` repo with 3 endpoints, KV bindings, env-var contract | Stripe **test-mode** end-to-end: pay with `4242…`, license email arrives via Resend, `/api/verify` returns OK |
| P2 — Frontend buy/unlock flow | Code | `/buy`, `/unlock`, `/unlocked` pages + isPro extension | Paying via test card unlocks bulk on the static site |
| P3 — Legal self-cert (template-driven, DE-only) | Yves + Cowork + Code | IT-Recht Kanzlei Starter Schutzpaket templates generated; diff-applied to AGB + Datenschutz + Widerrufsbelehrung; `/en/*` legal routes redirected to `/de/*`; beta framing on `/buy`; revenue tripwire documented | Template diff merged + tripwire in `AGENTS.md` (no lawyer signoff for v1; see P3 section below) |
| P4 — Stripe Tax + OSS | Yves | NL OSS registration done; Stripe Tax enabled in dashboard; Stripe in live mode | First real-money €1 test with personal card → invoice generated |
| P5 — Soft launch | Yves | Tweet / HN / DACH dev channels; monitor first 10 customers manually | First paid conversion through to bulk-export ZIP |

The brief below covers P1 and P2 in detail. P3 has its own short brief (`08-legal-checkbox.md`) once the lawyer review is done. P4 is a Yves task, not a Code task. P5 is a launch checklist, not a milestone.

## 3. Branch / repo setup

```bash
# Worker repo (new)
gh repo create yvendive/plainvoice-pay --private --clone
cd plainvoice-pay
# … then Code scaffolds the Worker

# Frontend repo (existing)
cd ~/Documents/Codex/x-rechnung-conversion
git checkout main && git pull
git checkout -b m7-stripe-paywall
```

P1 and P2 are separate PRs against separate repos. P2 is gated by env vars so it can ship to main without exposing the buy flow until P4 flips the flag.

---

# Phase 1 — Worker backend (`plainvoice-pay`)

## P1.1 Stack

- **Runtime**: Cloudflare Workers (TypeScript, ES2022)
- **Framework**: [Hono](https://hono.dev) — lightweight, well-typed, Workers-native
- **Storage**: Cloudflare KV (2 bindings: `LICENSES`, `PAYMENTS`)
- **Stripe SDK**: official `stripe` npm package, configured with `httpClient: Stripe.createFetchHttpClient()` for Workers compatibility
- **Email**: Resend SDK
- **Tests**: Vitest with `@cloudflare/vitest-pool-workers`

## P1.2 Endpoints

### `POST /api/checkout`

**Request body (JSON):**
```ts
{
  email: string;        // pre-filled into Stripe Checkout
  locale: 'de' | 'en';  // for Stripe Checkout language + receipt template
  consentWaiver: true;  // MUST be true (validated server-side)
  consentTimestamp: string; // ISO; client supplies, server logs
}
```

**Response (JSON):**
```ts
{ url: string }  // Stripe Checkout Session URL — frontend does window.location = url
```

**Behavior:**
- Validate body shape; reject if `consentWaiver !== true`.
- Create Stripe Checkout Session:
  - `mode: 'payment'`
  - `line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }]` (Price object configured in Stripe dashboard, not hardcoded)
  - `customer_email: body.email`
  - `locale: body.locale`
  - `automatic_tax: { enabled: true }` (Stripe Tax)
  - `tax_id_collection: { enabled: true }` (B2B reverse charge)
  - `invoice_creation: { enabled: true }`
  - `success_url: '${FRONTEND_URL}/${locale}/unlocked?session_id={CHECKOUT_SESSION_ID}'`
  - `cancel_url: '${FRONTEND_URL}/${locale}/buy?cancelled=1'`
  - `metadata: { consentWaiver: 'true', consentTimestamp: body.consentTimestamp, locale: body.locale }`
- Return `url`.

**CORS**: only allow `https://plainvoice.de` and `http://localhost:3000` (dev). Reject everything else.

### `POST /api/webhook`

**Authentication**: verify `Stripe-Signature` header against `env.STRIPE_WEBHOOK_SECRET` using `stripe.webhooks.constructEventAsync` (the async variant — sync version uses Node crypto and breaks in Workers).

**Events handled:**
- `checkout.session.completed` — customer paid
  1. Read `session.payment_intent`, `session.customer_email`, `session.metadata.locale`, `session.metadata.consentWaiver`, `session.metadata.consentTimestamp`.
  2. **Idempotency**: check `PAYMENTS.get(payment_intent_id)`. If exists, exit (webhook replay safety).
  3. Generate license key: `crypto.randomUUID()` then base64url-encode + truncate to 22 chars. Or use `nanoid` with custom alphabet.
  4. Build `LicenseRecord`:
     ```ts
     {
       key: string;
       email: string;
       stripePaymentIntentId: string;
       issuedAt: string;          // ISO
       consentWaiver: true;
       consentTimestamp: string;
       locale: 'de' | 'en';
     }
     ```
  5. `LICENSES.put(key, JSON.stringify(record))`
  6. `PAYMENTS.put(payment_intent_id, key)` (idempotency marker)
  7. Send email via Resend (template per locale — see P1.4).

- All other events: 200 OK (acknowledge but ignore).

Return 200 with empty body. Never echo customer data.

### `POST /api/verify`

**Request body:** `{ key: string }`

**Response:** `{ valid: boolean }` — boolean only, no record details.

**Behavior:**
- Trim + lowercase the key (forgiving paste).
- `LICENSES.get(key)` — if exists, return `{ valid: true }`.
- Otherwise `{ valid: false }`.
- **Rate limit**: 10 req/min per IP via Cloudflare Rate Limiting rule (configured at the dashboard level, not in Worker code).

**CORS**: same as `/api/checkout`.

## P1.3 Environment variables

Stored as Worker secrets (`wrangler secret put`):

| Var | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_…` or `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | from Stripe Dashboard → Webhooks → endpoint signing secret |
| `STRIPE_PRICE_ID` | `price_…` for €39 product |
| `RESEND_API_KEY` | Resend transactional API key |
| `RESEND_FROM_ADDRESS` | e.g. `noreply@plain-cards.com` (must be verified in Resend) |
| `FRONTEND_URL` | `https://plainvoice.de` (or `http://localhost:3000` in dev) |
| `ALLOWED_ORIGINS` | comma-separated CORS allowlist |

KV bindings (in `wrangler.toml`):

```toml
[[kv_namespaces]]
binding = "LICENSES"
id = "..."

[[kv_namespaces]]
binding = "PAYMENTS"
id = "..."
```

## P1.4 Email templates

Two templates, DE and EN, sent based on `metadata.locale`. Plain text + HTML version.

**DE subject**: `Ihr Plainvoice Pro Lizenzschlüssel`

**DE body (plain text)**:
```
Hallo,

vielen Dank für Ihren Kauf von Plainvoice Pro.

Ihr Lizenzschlüssel:

  {{license_key}}

So aktivieren Sie Pro:
1. Öffnen Sie https://plainvoice.de/de/unlock
2. Fügen Sie den Schlüssel ein
3. Klicken Sie auf "Aktivieren"

Der Schlüssel ist unbefristet gültig und an dieses Browser-Profil gebunden.
Bewahren Sie die E-Mail auf — bei Browserwechsel oder neuem Gerät benötigen Sie ihn erneut.

Eine Rechnung erhalten Sie separat von Stripe.

Bei Fragen: info@plain-cards.com

— YS Development B.V.
```

**EN equivalent**: same structure, English copy.

Both templates have a small HTML version (mono-font block for the key, single CTA link). Keep external CSS minimal — many email clients strip it.

## P1.5 KV record shapes

```ts
// LICENSES namespace
type LicenseRecord = {
  key: string;
  email: string;
  stripePaymentIntentId: string;
  issuedAt: string;          // ISO 8601
  consentWaiver: true;
  consentTimestamp: string;  // ISO 8601 — when checkbox was ticked
  locale: 'de' | 'en';
  revoked?: boolean;         // for future manual revocation
};

// PAYMENTS namespace — value is just the license_key string
```

## P1.6 Tests (Vitest)

- Unit: license key generator emits 22 URL-safe chars, no two equal in 100k draws (collision check).
- Unit: webhook signature verification rejects unsigned/wrong-signed payloads.
- Integration (`@cloudflare/vitest-pool-workers`):
  - POST /api/checkout with valid body → 200 + redirect URL
  - POST /api/checkout with `consentWaiver: false` → 400
  - POST /api/checkout from disallowed origin → 403
  - POST /api/webhook with stub `checkout.session.completed` → KV writes correct record + Resend mock called
  - POST /api/webhook replay (same payment intent) → no duplicate write, no duplicate email
  - POST /api/verify with valid key → `{ valid: true }`
  - POST /api/verify with invalid key → `{ valid: false }`
  - POST /api/verify with revoked key → `{ valid: false }`

## P1.7 Deploy

```bash
# Dev
pnpm wrangler dev

# Production
pnpm wrangler deploy
```

GitHub Actions workflow (`.github/workflows/deploy.yml`) on push to main:
- Lint, typecheck, test
- `wrangler deploy` with secrets from GH Actions secrets

## P1.8 Acceptance — Phase 1

- All 9 integration tests pass.
- Stripe test card `4242 4242 4242 4242` → webhook fires → KV has the license → Resend logs the email send → email arrives at the test inbox.
- `/api/verify` with that key returns `{ valid: true }`.
- Re-firing the webhook with the same payment intent does **not** create a second license, does **not** send a second email.
- `wrangler tail` shows clean logs; no PII (license keys + emails) in error stack traces.

---

# Phase 2 — Frontend buy/unlock flow (`plainvoice` repo)

## P2.1 New routes

All three under `src/app/[locale]/` so they participate in next-intl + the existing `LanguageToggle`.

### `/[locale]/buy`

Layout: same header/footer as `/impressum`. Centered max-width content.

Content (DE example, parallel EN):

```
H1: Plainvoice Pro

[Body, 1–2 paragraphs explaining what Pro unlocks: bulk conversion of multiple
files, folder drop, ZIP upload. Anchor on the M6 ProGate copy.]

Preis-Box:
  €39
  Einmalig — keine Abo-Kosten, keine Folgegebühren.
  Inkl. gesetzlicher Umsatzsteuer.

E-Mail-Feld:
  [E-Mail-Adresse für die Lizenz]

Checkbox (REQUIRED, MUST be ticked to enable button):
  ☐ Ich stimme ausdrücklich zu, dass die Lieferung des digitalen Inhalts
    sofort nach Vertragsschluss beginnt, und ich bestätige, dass ich
    dadurch mein Widerrufsrecht verliere.
    (Siehe AGB § 6.)

Button: [Jetzt für €39 kaufen]
  ← disabled until both email is valid AND checkbox is ticked

Links: AGB, Datenschutz, Impressum (already in footer; repeat near checkbox for visibility).
```

Button click handler:
1. `consentTimestamp = new Date().toISOString()`
2. POST `${WORKER_URL}/api/checkout` with `{ email, locale, consentWaiver: true, consentTimestamp }`
3. On 200: `window.location = response.url` (redirect to Stripe)
4. On error: show inline message in user's locale

### `/[locale]/unlocked`

Reached via Stripe `success_url`. Reads `session_id` from query string.

Content:
```
H1: ✓ Vielen Dank!

Body: Ihre Zahlung war erfolgreich. Wir haben Ihnen Ihren Lizenzschlüssel
soeben per E-Mail an {Email} geschickt. Bitte prüfen Sie auch den Spam-Ordner.

CTA Button: [Lizenzschlüssel jetzt eingeben →]
  → links to /[locale]/unlock
```

This page **does not call the Worker**. It's purely a thank-you page. The license is sent by webhook → email; we don't show it in the URL or this page (security: success_url is GET-leakable via Referrer, browser history, server logs).

### `/[locale]/unlock`

Content:
```
H1: Pro aktivieren

Body: Fügen Sie Ihren Lizenzschlüssel ein. Sie haben ihn nach dem Kauf
per E-Mail erhalten.

[Textarea for license key]

Button: [Aktivieren]

State machine:
  idle → verifying → success ✓ (auto-redirect to /de after 2s) → idle (on error)
```

Verification flow:
1. POST `${WORKER_URL}/api/verify` with `{ key }`
2. On `{ valid: true }`:
   - `localStorage.setItem('plainvoice.pro', '1')`
   - `localStorage.setItem('plainvoice.pro.key', key)` (so we can revoke later)
   - Show success state
   - After 2s, `router.push('/${locale}')`
3. On `{ valid: false }`: show inline error "Schlüssel ungültig oder bereits revoziert."
4. Network error: "Verbindung fehlgeschlagen — bitte versuchen Sie es erneut."

## P2.2 Entitlement (extend M6 stub)

`src/lib/entitlement.ts` (currently `isPro()` — extend, don't replace):

```ts
const KEY = 'plainvoice.pro';
const KEY_LICENSE = 'plainvoice.pro.key';
const URL_OVERRIDE = 'pro';  // ?pro=1 — keeps dev/QA path

export function isPro(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get(URL_OVERRIDE) === '1') {
    try { localStorage.setItem(KEY, '1'); } catch {}
    return true;
  }
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function getStoredLicenseKey(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(KEY_LICENSE); } catch { return null; }
}

export function lockPro(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEY_LICENSE);
  } catch {}
}
```

## P2.3 Update ProGate component

The "Coming soon" disabled button (M6) becomes a real CTA:

```tsx
<Link
  href={`/${locale}/buy`}
  className="…primary button styles…"
>
  {tProGate('cta')}  // "€39 — jetzt kaufen" / "€39 — buy now"
</Link>
```

Conditional: only show when `process.env.NEXT_PUBLIC_PAYWALL_LIVE === 'true'`. While the env flag is `false` (default), keep showing "Coming soon" so we can deploy P2 without exposing the buy flow until P4.

## P2.4 New i18n keys

Add to both `de.json` and `en.json`. Keep DE/EN parity test happy — the M4.5.x coverage test will catch accidental English copy in DE.

```json
"Buy": {
  "title": "Plainvoice Pro",
  "subtitle": "Mehrere Rechnungen auf einmal konvertieren.",
  "priceAmount": "€39",
  "priceCadence": "Einmalig — keine Abo-Kosten, keine Folgegebühren.",
  "priceVat": "Inkl. gesetzlicher Umsatzsteuer.",
  "emailLabel": "E-Mail-Adresse für die Lizenz",
  "emailPlaceholder": "ihre@adresse.de",
  "emailInvalid": "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
  "consentLabel": "Ich stimme ausdrücklich zu, dass die Lieferung des digitalen Inhalts sofort nach Vertragsschluss beginnt, und ich bestätige, dass ich dadurch mein Widerrufsrecht verliere. (Siehe AGB § 6.)",
  "buyButton": "Jetzt für €39 kaufen",
  "errorGeneric": "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
  "back": "Zurück"
},
"Unlocked": {
  "title": "Vielen Dank!",
  "body": "Ihre Zahlung war erfolgreich. Wir haben Ihnen Ihren Lizenzschlüssel soeben per E-Mail geschickt. Bitte prüfen Sie auch den Spam-Ordner.",
  "cta": "Lizenzschlüssel jetzt eingeben →"
},
"Unlock": {
  "title": "Pro aktivieren",
  "body": "Fügen Sie Ihren Lizenzschlüssel ein. Sie haben ihn nach dem Kauf per E-Mail erhalten.",
  "keyPlaceholder": "Ihr Lizenzschlüssel",
  "activateButton": "Aktivieren",
  "stateVerifying": "Wird geprüft …",
  "stateSuccess": "Aktiviert. Sie werden weitergeleitet …",
  "errorInvalid": "Schlüssel ungültig oder bereits revoziert.",
  "errorNetwork": "Verbindung fehlgeschlagen — bitte versuchen Sie es erneut.",
  "back": "Zurück"
},
"ProGate": {
  // Existing keys + extend:
  "cta": "€39 — jetzt kaufen"
}
```

## P2.5 Sitemap + metadata

- Add `/de/buy`, `/en/buy`, `/de/unlock`, `/en/unlock` to `src/app/sitemap.ts` at priority 0.5 monthly.
- `/unlocked` is **excluded** from sitemap (it's a transactional landing page reached only via Stripe redirect; no SEO value, and we don't want it crawled).
- Add `noindex` to `/unlocked` metadata: `robots: { index: false, follow: false }`.

## P2.6 Env vars (frontend)

In `.env.local` and Vercel/easyname env config:

```
NEXT_PUBLIC_PAYWALL_LIVE=false       # flip to true at P4
NEXT_PUBLIC_WORKER_URL=https://plainvoice-pay.workers.dev
```

`NEXT_PUBLIC_*` is fine here — neither URL is secret. The Worker rejects unallowed origins; the flag is purely UX.

## P2.7 Tests

- E2E (Playwright if it exists; otherwise vitest + jsdom for the verify page):
  - `/de/buy` button stays disabled until email is valid + checkbox ticked
  - Clicking the button POSTs to mock Worker URL with the right body shape
  - `/de/unlock` happy path: paste valid key (mocked Worker) → localStorage written → redirect
  - `/de/unlock` invalid key: shows error in correct locale
- Unit: `getStoredLicenseKey()` returns null when missing
- Existing `?pro=1` URL override still works (regression test)

## P2.8 Acceptance — Phase 2

- With `NEXT_PUBLIC_PAYWALL_LIVE=false`, the live site is **visually unchanged** — bulk still says "Coming soon". The new pages exist but are unlinked from the home page.
- With `NEXT_PUBLIC_PAYWALL_LIVE=true` (locally only for now), `/de/buy` works end-to-end with Stripe test mode + Worker dev instance:
  - Pay with `4242 4242 4242 4242` → redirect to Stripe → pay → redirect to `/de/unlocked`
  - Email arrives within 30s
  - `/de/unlock` accepts the key → localStorage set → redirect home → bulk uploader is now active
- All M4.5.x DE/EN parity tests still green.
- `?pro=1` still unlocks (dev override preserved).

---

# Phase 3 — Legal self-cert (template-driven, no lawyer for v1)

**Decision (2026-04-27):** Skip the upfront human-lawyer review for v1. Use commercial AGB/Datenschutz template generators as a cross-check, ship behind beta framing + a generous refund stance, and engage a real lawyer when the revenue tripwire fires (see AGENTS.md). Trade-off: defers ~€500 in lawyer fees, accepts marginally higher Abmahnung exposure that's recoverable for ~€500–1500 if it ever materializes. Defensible at pre-revenue stage.

## P3a — Generate templates (Yves)

**Vendor: IT-Recht Kanzlei Starter Schutzpaket** (€9.90/mo, monthly cancellable, booked 2026-04-29).

Why not Trusted Shops Legal: their signup blocks NL-domiciled companies at the country picker (DE/AT/CH only). IT-Recht Kanzlei is a Munich e-commerce specialist law firm whose general AGB product is built for sellers serving the German market regardless of seller domicile.

**Scope: DE-only legal pages.** EN legal pages are dropped — `/en/agb`, `/en/widerruf`, `/en/datenschutz`, `/en/impressum` redirect to their `/de/*` equivalents. Plainvoice's audience is by definition DE-tax-adjacent (X-Rechnung is mandatory only for German B2B/public-sector e-invoicing) so the EN UI without EN legal text is a defensible product decision and removes the translation-drift maintenance burden every time IT-Recht updates a template. Product pages (`/buy`, `/unlock`, `/unlocked`) and the license email stay bilingual.

Wizard configuration (in IT-Recht Kanzlei's Mandantenportal, after their signup confirmation arrives):
- Vertragslaufzeit: **Monatlich kündbar** (already correct in screenshot)
- Rechtstext: under "Besondere Geschäftsmodelle" pick **"Online-Shop (digitale Inhalte)"** — NOT "Onlineshop DE" (that's physical goods) and NOT "Shop - Verkauf von eigener Software" (that's downloadable executables, wrong fit for browser SaaS)
- Sprache: Deutsch only (no EN add-on — see scope decision above)

Inputs to fill in the Rechtstext config wizard:
- Company: YS Development B.V., Prins Hendrikplein 8, 2264 SL Leidschendam, NL
- KvK 93236867, VAT NL866322887B01
- Business model: digital content (Plainvoice Pro license unlocks browser-based bulk conversion of X-Rechnung XML to CSV/TXT/XLSX/PDF)
- Audience: B2C + B2B
- Key feature to enable: **Widerrufsbelehrung mit Muster-Widerrufsformular für digitale Inhalte** (the immediate-execution waiver variant — §356(5) BGB)

If the wizard rejects "Niederlande" as Sitz des Unternehmens: stop, screenshot, and email IT-Recht Kanzlei sales (`info@it-recht-kanzlei.de`) before paying. Fallback vendor: Händlerbund (EU-wide, confirmed multi-domicile-friendly).

Outputs to save to `docs/legal-templates/` in the frontend repo (or paste to Cowork directly):
- `agb.md` (or `agb.pdf` + extracted text)
- `datenschutzerklaerung.md`
- `widerrufsbelehrung.md` + `muster-widerrufsformular.md`

## P3b — Diff templates vs. our drafts (Cowork + Yves)

Cowork Claude reads the templates, diffs section-by-section against the merged `/de/agb`, `/de/datenschutz`, AGB §6, and the email template. Surfaces:
- Sections in the template not in our drafts (most likely: explicit `Muster-Widerrufsformular` link, broader liability disclaimers, possibly cookie/local-storage disclosure even though we don't use cookies)
- Wording differences in the §6 expiry/waiver clause
- Stronger Datenschutz wording on US sub-processor disclosures (Stripe US, Resend US)

Output: `m7-p3-template-driven-revisions` PR draft against the frontend repo.

## P3c — Beta framing + email Widerrufsformular link + DE-only legal routing (Code)

Three frontend changes:

1. **Beta badge** on `/[locale]/buy` and `/[locale]/unlocked`. Subtle inline copy:
   - DE: "Plainvoice Pro ist im Early-Access. Probleme? Schreiben Sie uns an info@plain-cards.com — wir kümmern uns."
   - EN: "Plainvoice Pro is in early access. Issues? Email info@plain-cards.com and we'll make it right."

2. **Muster-Widerrufsformular** at `/de/widerruf` (DE only) with the model form text + a `mailto:info@plain-cards.com?subject=Widerruf%20Plainvoice%20Pro` link. Linked from:
   - The license email template (DE: direct link; EN: same `/de/widerruf` link labelled "(in German)")
   - `/[locale]/unlock`, in a small footer link (EN locale labels it "(in German)")

3. **DE-only legal page routing.** Drop the EN legal pages and redirect their routes to the DE equivalents:
   - `/en/agb` → `/de/agb`
   - `/en/datenschutz` → `/de/datenschutz`
   - `/en/widerruf` → `/de/widerruf`
   - `/en/impressum` → `/de/impressum`
   - Implementation: Next.js `redirects()` in `next.config.ts`, or `notFound()` + client redirect on the EN page bodies, whichever ships cleaner with the static export.
   - Footer in EN locale links directly to `/de/agb`, `/de/datenschutz`, `/de/impressum` and labels each "(German)" so users know what they're clicking into.
   - `/buy` consent checkbox in EN locale: link text becomes `AGB (in German)` and `Widerrufsbelehrung (in German)`; both link to `/de/*`.
   - Remove any EN legal-text translation keys from `en.json` (the parity test shouldn't fire for legal copy because the corresponding DE keys must also be removed if they were under a shared namespace — Code triages whether keys are page-scoped or shared).

Belt-and-braces — even if §6 waiver is ticked, customers always have a clear path to exercise it.

## P3d — Document the lawyer-engagement tripwire (Cowork)

Add to `AGENTS.md` "When to engage a real lawyer":
- First €1,000 cumulative revenue, OR
- First 25 paid customers, OR
- First customer complaint / dispute / chargeback / Abmahnung.

Whichever fires first triggers an immediate 1–2 hour lawyer engagement (DACH IT-Recht specialist, ~€300–600 budget) for a full review of AGB + Datenschutz + email template.

## Operational policy until tripwire fires

- **No-questions-asked refund within 30 days** of purchase, regardless of §6 waiver. Document this internally; do NOT change the AGB to promise it (operational stance ≠ contractual right). Refund via Stripe Dashboard.
- **No active enforcement of §6 waiver.** If a customer disputes within 14 days, refund without challenge.
- Track every refund + complaint in a simple log (`docs/operations/refund-log.md`) so we have data when the tripwire engagement happens.

---

# Phase 4 — Stripe Tax + OSS (Yves task, not Code)

1. Register for Dutch OSS (One Stop Shop) at the Belastingdienst portal. ~€0 cost, but quarterly returns required.
2. In Stripe Dashboard → Tax → enable for the Netherlands as origin.
3. Add EU country tax registrations: at minimum DE, AT, NL. Stripe Tax handles the rest by deferring to OSS.
4. Configure Stripe Customer Portal (optional, low priority).
5. Switch Worker secrets to live keys: `STRIPE_SECRET_KEY=sk_live_...`, `STRIPE_WEBHOOK_SECRET=whsec_live_...`, `STRIPE_PRICE_ID=price_live_...`.
6. Flip `NEXT_PUBLIC_PAYWALL_LIVE=true` in production env, redeploy.
7. Test with personal card (€39 round-trip) — refund yourself afterwards via Stripe Dashboard.

---

# Phase 5 — Soft launch

Acceptance for "we are live":

- 5 successful test transactions with own card (refunded) using DE + AT + EU-VAT-exempt + non-EU + Apple Pay
- 1 successful real-money transaction from a friend
- Resend dashboard shows 100% delivery rate
- Stripe Dashboard shows the OSS-distributed VAT lines correctly
- No webhook errors in `wrangler tail` over 24h

Then: announce on HN, /r/de_buchhaltung, DACH dev Slack, X.

---

## Out of scope (parked for M8+)

- User accounts / login
- Multi-device sync beyond pasted-key (a paid customer must keep the email; we don't sync to a profile)
- Refund automation (do refunds manually via Stripe Dashboard for v1)
- Multiple price tiers (Pro vs Team — only Pro for v1)
- License revocation UI for Yves (use Stripe Dashboard + `wrangler kv:key delete` manually for v1)
- Subscription model (one-time only; subscriptions raise WAY more legal complexity, churn metrics, Stripe Billing setup)
- Yearly invoicing aggregation
- Customer-facing support portal — `mailto:` is fine

---

## Pre-launch P3 checklist (template-driven self-cert)

Replaces the previous lawyer-review checklist per the 2026-04-27 path-3 decision.

- [x] P3a: IT-Recht Kanzlei Starter Schutzpaket booked (€9.90/mo, monthly cancellable, 2026-04-29). Awaiting Mandantenportal access.
- [ ] P3a: Wizard run with "Online-Shop (digitale Inhalte)" Rechtstext + BV details + B2C+B2B + immediate-execution-waiver settings
- [ ] P3a: Generated AGB / Datenschutz / Widerrufsbelehrung saved to `docs/legal-templates/` in the frontend repo
- [ ] P3b: Cowork Claude has produced a section-by-section diff vs. the merged drafts and opened `m7-p3-template-driven-revisions` PR
- [ ] P3b: PR merged (Code applies the diff; Cowork reviews against the brief)
- [ ] P3c: Beta framing copy added to `/[locale]/buy` + `/[locale]/unlocked` (DE + EN)
- [ ] P3c: Muster-Widerrufsformular drafted, added as `/de/widerruf` (DE only), linked from email + `/unlock`
- [ ] P3c: Email template DE + EN updated to include Widerrufsformular link (EN labels it "(in German)")
- [ ] P3c: `/en/*` legal routes redirect to `/de/*`; EN footer + checkout consent links updated with "(in German)" labels
- [ ] P3d: Tripwire policy in `AGENTS.md` (€1k revenue / 25 customers / first complaint)
- [ ] P3d: Operational refund policy documented (no-questions-asked 30-day until tripwire)
- [ ] Datenschutz expanded to include Resend (US, SCCs) — should already be in template output
- [ ] Datenschutz expanded to include Cloudflare (US, SCCs — Cloudflare Workers do process data through US-region edge nodes)
- [ ] Stripe Tax invoice template enabled in Dashboard (P4 task; checked here to confirm it's coming)

When the tripwire fires (post-launch), open `docs/handoffs/09-lawyer-review.md` for the formal review and any required revisions.

## Locked decisions (kickoff inputs)

| Topic | Decision |
| --- | --- |
| Email sender | `noreply@plain-cards.com` (DNS already in place; verify SPF/DKIM/DMARC in Resend) |
| `plainvoice-pay` repo visibility | **Public** — symmetry with MIT frontend; secrets live in Wrangler, not in code; serves as trust signal |
| Stripe account | New, registered under **YS Development B.V.** (required for VAT + OSS) |
| Refund policy | Keep §6 waiver as drafted (immediate-execution → loss of withdrawal right) |
| Legal-template vendor | **IT-Recht Kanzlei Starter Schutzpaket** (€9.90/mo, monthly cancellable, booked 2026-04-29). Trusted Shops Legal blocked NL BVs at signup. |
| Legal page locale scope | **DE only.** EN routes (`/en/agb`, `/en/widerruf`, `/en/datenschutz`, `/en/impressum`) redirect to DE equivalents. Audience is DE-tax-adjacent by definition; eliminates translation-drift maintenance. |

## Stripe test-mode artifacts (pre-created for P1)

These are already provisioned in Stripe sandbox mode (account `acct_1TQrJMLJIGoQ4ULV`, "YS Development B.V. sandbox").

| Var | Value |
| --- | --- |
| Stripe account ID | `acct_1TQrJMLJIGoQ4ULV` |
| Product ID | `prod_UPh1bz3Pccn79X` (name: "Plainvoice Pro") |
| `STRIPE_PRICE_ID` (test) | `price_1TQrvNLJIGoQ4ULVse5c7P7X` (€39 EUR, one-time) |
| Webhook endpoint ID | `we_1TQw3HLJIGoQ4ULVg9fyCjgt` (events: `checkout.session.completed`) |

Live-mode equivalents are NOT created yet — that happens at P4 alongside Stripe Tax + OSS registration.

## Deployed P1 artifacts (canonical inputs for P2)

P1 shipped successfully: PR yvendive/plainvoice-pay#1 merged + green CI/deploy on commit `a8c1080`. End-to-end test passed (real Stripe checkout → KV write → Resend email → verify round-trip).

| Var | Value |
| --- | --- |
| `NEXT_PUBLIC_WORKER_URL` (test) | `https://plainvoice-pay.yvendive.workers.dev` |
| `/api/checkout` | POST `{ email, locale, consentWaiver: true, consentTimestamp }` → `{ url }` |
| `/api/verify` | POST `{ key }` → `{ valid: boolean }` |
| Worker subdomain owner | `yvendive.workers.dev` (account-level; survives across Worker projects) |

## Pricing experiments parked for post-launch A/B

Each of these is documented here so the moment metrics come in (conversion rate, refund rate, support volume, geographic mix), we have a list to pull from rather than reinventing the question.

1. **Tiered pricing** — split into a Light tier (e.g. €19, ≤20 files/batch) and Pro (€39, unlimited). Lever: capture lower-willingness-to-pay segment without dropping the Pro price. Cost: another Stripe Price ID, another entitlement state in `isPro()`, additional copy throughout. Worth testing once we have ≥6 weeks of single-tier conversion data to compare against.
2. **Team license** — multi-seat license, e.g. €99 for 3 keys, sold to accountancies and bookkeeping firms. Eng cost is low (the Worker mints N keys per checkout), legal cost is moderate (AGB needs a "permitted users" clause). High potential ARPU lift if even a handful of small firms convert.
3. **Display experiments** — `€39` vs `€39 incl. VAT` vs `€32.77 + VAT`, plus the consent-checkbox copy itself. Only meaningful once OSS data shows whether DACH B2C buyers behave differently from B2B reverse-charge buyers; until then we have no signal worth A/B-ing on.
4. **Currency expansion** — add USD pricing for non-EU buyers. Eng work in Stripe + tax is non-trivial (US sales tax nexus rules differ wildly from VAT). Skip until non-EU traffic is meaningful — say, ≥10% of `/buy` page sessions per Plausible-equivalent telemetry (which we don't yet have either, so this is gated on telemetry too).
5. **White-label / OEM licensing** — sell a re-branded version of the bulk converter to accounting software vendors (DATEV, lexoffice, sevDesk, Buchhaltungsbutler) or to corporate finance teams who want it on their intranet. Naturally pairs with the Team-license tier above as the upgrade path: solo (€39) → team (€99) → white-label (custom contract). Eng cost is moderate (deploy artifact split, theming variables, embed-friendly bundle); legal cost is high (separate B2B contract, brand-use rights, support SLA). Highest revenue ceiling of any item on this list — one DATEV integration could 10× the BV's revenue. Park until we have either inbound interest or a stable v1 with usage data to take into a sales conversation.

When we kick off the post-launch metrics review (M9?), this list is the agenda.

## Open questions still pending

- **Trademark registration** — "Plainvoice" as an EU word mark via EUIPO (~€850, 4–6 months). Decoupled from M7 but worth filing now since EUIPO is slow and the brand is the actual moat under MIT. Yves task.
- **AGB §2 self-hosting carve-out** — add to lawyer review: a clause stating the Pro license covers use of the hosted service at plainvoice.de, not self-hosted forks. Belt-and-braces given MIT licensing on the frontend.
- **Email DNS hardening** — Resend will require SPF + DKIM. DMARC alignment policy (`p=none` initially, `p=quarantine` once delivery is stable) — Yves task before P1 deploy, otherwise license emails go to spam.

P1 kickoff is unblocked. Ready to draft the Code message for the Worker backend whenever you give the green light.
