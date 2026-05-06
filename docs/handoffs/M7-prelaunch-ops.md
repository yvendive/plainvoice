# M7 pre-launch ops verification

**Model:** Claude Sonnet 4.6 — docs and `.gitignore` work, no application code touched.

Closes pentest issues `plainvoice-pay#7` (KV namespace cross-check), `plainvoice#20` (ops bundle: gitignore + KV backup + incident response), and `plainvoice-pay#10` (Cloudflare Rate Limiting). Three workstreams; this brief covers Code's piece (docs + gitignore). Yves runs the dashboard tasks separately.

## Yves dashboard tasks (NOT Code's work)

Run these any time before P4. They're independent of the Code PR.

### KV namespace cross-check (Issue plainvoice-pay#7)

```bash
cd ~/Documents/Codex/plainvoice-pay && \
pnpm wrangler kv namespace list
```

Compare the listed IDs against `wrangler.toml`:
- LICENSES: `22fc1d88e2034628a500307c5c6a9c82`
- PAYMENTS: `d2429a43a9aa43c188b7858e1744c083`

Both should match. If they do, comment-close `plainvoice-pay#7` with the listing output as evidence.

### Cloudflare Rate Limiting Rules (Issue plainvoice-pay#10)

Cloudflare dashboard → Workers & Pages → `plainvoice-pay` → Settings → Triggers (or Rules → Rate limiting rules at the zone level — exact UI depends on whether the worker is fronted by a Cloudflare zone). Add three rules:

| Path | Limit | Window | Action |
| --- | --- | --- | --- |
| `/api/verify` | 30 req | 1 min per IP | Return 429 |
| `/api/checkout` | 10 req | 1 min per IP | Return 429 |
| `/api/webhook` | (no limit — Stripe-signed) | — | — |

Burst-test post-launch: from your terminal, `for i in {1..50}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST https://plainvoice-pay.yvendive.workers.dev/api/verify -d '{}' -H 'Content-Type: application/json'; done | sort | uniq -c` — should show a mix of 200s (early) and 429s (after the limit kicks in).

Comment-close `plainvoice-pay#10` with a one-line "Rate limits configured for /api/verify (30/min) and /api/checkout (10/min) per IP. Webhook unrate-limited (signature-gated)."

### NL OSS verification

Quick sanity-check (you mentioned VAT + Stripe Tax done, ensuring OSS is in there):
- Belastingdienst portal → confirm OSS registration is active for your BV.
- Stripe Dashboard → Tax → Settings → confirm "EU OSS" is selected as the registration scheme for EU-non-NL transactions.

If both yes, P4's tax piece is actually complete and you can skip ahead to live-keys-and-flag-flip when you're ready.

## Code task — one PR, two repos

This brief lives in the frontend repo. The work spans both repos:
- Frontend repo (`x-rechnung-conversion`): `.gitignore` tightening + new runbook files in `docs/security/`
- Worker repo (`plainvoice-pay`): `.gitignore` tightening only

Two small PRs (one per repo), both following the standard pattern.

### Setup (Code follows in this exact order)

1. `cd ~/Documents/Codex/x-rechnung-conversion`. Read AGENTS.md.
2. Per "Handoff briefs" rule #5, commit and push THIS brief at `docs/handoffs/M7-prelaunch-ops.md` to `origin/main` of the frontend repo. Standard safety check.
3. Branch: `git checkout main && git pull origin main && git checkout -b m7-prelaunch-ops-frontend`.
4. Apply the frontend changes below in this branch, push, open PR.
5. Switch repos: `cd ~/Documents/Codex/plainvoice-pay && git checkout main && git pull origin main && git checkout -b m7-prelaunch-ops-worker`.
6. Apply the Worker changes, push, open PR.

### Frontend repo changes

#### `.gitignore` patch

Append to `.gitignore`:

```
# Cowork PM 2026-04-30: pre-launch ops bundle (closes plainvoice#20).
# Existing patterns covered .env / .env.* — these add explicit
# safety for files that aren't strictly env-files.
.dev.vars
.dev.vars.*
*.pem
*.key
wrangler.local.toml
```

Don't deduplicate against `.env.*` — the pre-existing wildcard already covers `.env.local` etc.; the new entries cover other secret-shaped files that wildcard misses.

#### Create `docs/security/kv-backup.md`

Full content:

```markdown
# KV backup runbook

Cloudflare Workers KV is durable but **not** versioned and **not** automatically backed up. Accidental deletion or corruption of the `LICENSES` or `PAYMENTS` namespace would strand paying customers without a recovery path. This runbook documents the v1 manual backup process.

## What we back up

Two production KV namespaces:
- **LICENSES** — `key = <license_key>`, `value = LicenseRecord` (email, stripePaymentIntentId, issuedAt, consentWaiver, consentTimestamp, locale, key, optional revoked flag).
- **PAYMENTS** — `key = stripe_payment_intent_id`, `value = license_key`. Idempotency mapping; allows recovering license keys from Stripe payment IDs and vice versa.

## Cadence

**Weekly, Monday morning (Yves task).** Manual for v1; automate post-launch when license volume justifies the engineering investment (Workers Cron + scheduled task → R2 bucket).

## Backup procedure

```bash
cd ~/Documents/Codex/plainvoice-pay
DATE=$(date +%Y-%m-%d)
mkdir -p ~/plainvoice-backups/$DATE

# LICENSES namespace
pnpm wrangler kv key list --binding LICENSES > ~/plainvoice-backups/$DATE/licenses-keys.json
jq -r '.[].name' ~/plainvoice-backups/$DATE/licenses-keys.json | while read key; do
  pnpm wrangler kv key get --binding LICENSES "$key" > ~/plainvoice-backups/$DATE/licenses-$key.json
done

# PAYMENTS namespace
pnpm wrangler kv key list --binding PAYMENTS > ~/plainvoice-backups/$DATE/payments-keys.json
jq -r '.[].name' ~/plainvoice-backups/$DATE/payments-keys.json | while read key; do
  pnpm wrangler kv key get --binding PAYMENTS "$key" > ~/plainvoice-backups/$DATE/payments-$key.json
done

# Tar + encrypt the backup directory
tar -czf - -C ~/plainvoice-backups $DATE | \
  openssl enc -aes-256-cbc -salt -pbkdf2 -out ~/plainvoice-backups/$DATE.tar.gz.enc
rm -rf ~/plainvoice-backups/$DATE
```

The encrypted archive `~/plainvoice-backups/<date>.tar.gz.enc` is what gets retained. Store the openssl passphrase in your password manager (1Password, Bitwarden, etc.) — losing it equals losing the backup.

**Retention:** keep the most recent 12 weekly backups, plus monthly snapshots of the rest. ~13 archives at any time.

## Restore procedure

```bash
# Decrypt + extract
openssl enc -d -aes-256-cbc -pbkdf2 -in ~/plainvoice-backups/<date>.tar.gz.enc | tar -xzf - -C ~/plainvoice-backups/

# For each license file in the extracted directory, restore to KV:
for f in ~/plainvoice-backups/<date>/licenses-*.json; do
  key=$(basename "$f" .json | sed 's/^licenses-//')
  pnpm wrangler kv key put --binding LICENSES "$key" --path "$f"
done

# Same for payments:
for f in ~/plainvoice-backups/<date>/payments-*.json; do
  key=$(basename "$f" .json | sed 's/^payments-//')
  pnpm wrangler kv key put --binding PAYMENTS "$key" --path "$f"
done
```

## When to restore

- Accidental `wrangler kv namespace delete` of LICENSES or PAYMENTS.
- Cloudflare incident report indicating data loss in the EU-region KV cluster (rare).
- Suspected corruption (verify endpoint returns false for known-good keys).

## Owner

**Yves.** Backup is a Yves-only operational task — Cowork PM and Code do not have access to the encrypted archives.

## Post-launch follow-up

Once we have >50 paying customers OR weekly backup runtime exceeds 5 minutes, automate via Workers Cron + R2 bucket. Track as a post-launch maintenance ticket.
```

#### Create `docs/security/incident-response.md`

Full content:

```markdown
# Incident response runbook

Pre-launch v1 runbook covering the most likely Plainvoice incidents: Worker secret leak, license-issuance bug, customer payment dispute, suspected unauthorized access to KV. Each section is one decision tree.

## Incident severity tiers

| Tier | Examples | Response time |
| --- | --- | --- |
| **SEV0 — active customer harm** | Worker offline, payments processed without license issuance, secret exposed publicly | Immediate (within 15 min) |
| **SEV1 — customer-impacting** | Single customer's license missing, email delivery failed, refund dispute | Within 4 hours |
| **SEV2 — risk to integrity, no active harm yet** | Suspected unauthorized KV access, failed deploy, CI red | Within 24 hours |
| **SEV3 — minor** | Documentation drift, cosmetic UI bug | Next business day |

## Worker secret rotation

If a Wrangler secret is suspected compromised (e.g., shoulder-surfed during deploy demo, leaked in error logs you didn't realize were public):

```bash
cd ~/Documents/Codex/plainvoice-pay
pnpm wrangler secret put NAME  # overwrites existing value, no --env
```

Plainvoice's secrets:
- `STRIPE_SECRET_KEY` — rotate via Stripe Dashboard → Developers → API keys → Roll
- `STRIPE_WEBHOOK_SECRET` — rotate via Stripe Dashboard → Developers → Webhooks → endpoint → Roll signing secret
- `STRIPE_PRICE_ID` — not secret, public; if changed, requires app deploy
- `RESEND_API_KEY` — rotate via Resend Dashboard → API Keys → revoke + create new
- `RESEND_FROM_ADDRESS` — not secret per se, but format-controlled

After rotation: `wrangler tail` to watch for any `*_failed` events for ~5 min as the rotation propagates.

## License invalidation (revoke a single key)

If a customer reports their license key was leaked / stolen:

```bash
cd ~/Documents/Codex/plainvoice-pay
# Mark the license as revoked (verify endpoint will return invalid)
pnpm wrangler kv key get --binding LICENSES "<license_key>" | \
  jq '. + {revoked: true}' | \
  pnpm wrangler kv key put --binding LICENSES "<license_key>" --path -

# Issue a replacement license manually if appropriate (note: pre-launch
# we'd just refund + re-purchase; document the manual issuance once
# we've codified that flow).
```

## Customer payment dispute / refund

Per AGENTS.md "When to engage a real lawyer" tripwire policy: **no-questions-asked refund within 30 days, regardless of the §6 AGB waiver**, until the tripwire fires (€1k cumulative revenue / 25 customers / first complaint).

```
1. Stripe Dashboard → Payments → find the disputed payment intent
2. Refund (full unless customer asked for partial)
3. wrangler kv key delete --binding LICENSES "<license_key>"
4. wrangler kv key delete --binding PAYMENTS "<stripe_pi_id>"
5. Email customer: "Refund processed, license revoked. Sorry it didn't work for you. Yves"
6. Log in docs/operations/refund-log.md (date, reason, key prefix only)
```

If the dispute is a Stripe chargeback (bank-initiated reversal, not customer-initiated refund): respond via Stripe's dispute interface within 7 days with email correspondence + the consent-timestamp from the LicenseRecord as evidence.

## Suspected unauthorized KV access

If you see KV writes you didn't authorize (e.g., licenses appearing for payment IDs you don't recognize in Stripe):

1. **Immediately** rotate `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`.
2. Audit recent KV writes: `wrangler tail --format pretty` for ~10 minutes to characterize the pattern.
3. If unauthorized writes continue: `wrangler kv namespace delete LICENSES` followed by recreation + re-deploy. This locks out attackers but also revokes ALL legitimate licenses — proactively refund all paying customers in parallel.
4. Engage the Dutch/German IT-Recht lawyer per AGENTS.md tripwire (this counts as a "first complaint or breach" trigger).
5. Customer notification: standard breach-notice email per Art. 34 DSGVO if personal data was accessed (license records contain customer email + timestamp; that's enough to require notification under Art. 4(1)).

## Communications templates

### Refund email (DE)

```
Betreff: Refund Plainvoice Pro

Hallo,

Ihre Zahlung von 39,00 € wurde soeben über Stripe vollständig erstattet
(2-5 Werktage bis zur Gutschrift auf Ihrer Karte). Ihr Lizenzschlüssel
wurde gleichzeitig deaktiviert.

Wenn Plainvoice nicht das Richtige für Sie war, freut mich Ihre offene
Rückmeldung — was hat nicht funktioniert?

Beste Grüße,
Yves Schulz
YS Development B.V.
```

### Breach notification (Art. 34 DSGVO)

Drafted only when needed; engage the IT-Recht lawyer to finalize wording before sending. Required elements per Art. 34: nature of the breach, name+contact of DPO/responsible party (you), likely consequences, measures taken to mitigate, and contact for further info.

## Stripe support

For Stripe-side issues (account suspended, payment processor disagreement, account-level incident):
- Stripe Dashboard → Help → Contact support (24h response, Pro account level).
- For escalations: support@stripe.com with subject line including account ID `acct_1TQrJMLJIGoQ4ULV` and a clear one-sentence summary.

## Owner

**Yves runs incidents.** Cowork PM advises but does not execute (no live-mode key access per AGENTS.md "Money and identity"). For the lawyer-engagement tripwires, see AGENTS.md "When to engage a real lawyer."

## Post-incident

- Update `docs/operations/refund-log.md` (or create it for a first incident) with date, severity, summary, resolution, time-to-resolve.
- If SEV0 or SEV1: write a short post-mortem in `docs/operations/postmortems/<date>-<slug>.md`. No blame; focus on what we'd change.
- Bring the post-mortem into the next Cowork PM session for review and action items.
```

### Worker repo changes (separate PR)

#### `.gitignore` patch

Append to the Worker repo's `.gitignore` (it already has `.dev.vars`, `.env`, `.env.local`):

```
# Cowork PM 2026-04-30: pre-launch ops bundle (closes plainvoice#20).
.env.*.local
*.pem
*.key
wrangler.local.toml
```

That's the only Worker-side change in this PR.

## Hard rules

- **Two PRs total**, one per repo. Don't try to merge them.
- `pnpm lint && pnpm typecheck && pnpm test` should still pass — no application code touched in either repo.
- **The runbook content above is canonical** — copy it verbatim into the new files. Don't paraphrase or reformat.
- The brief itself stays in the frontend repo's `docs/handoffs/`. Code self-commits per rule #5.

## When done

Reply to Yves with:
- Frontend PR URL (runbooks + .gitignore).
- Worker PR URL (.gitignore only).
- Confirmation that no application code was touched in either repo.

After Yves merges both PRs, comment-close `plainvoice#20` referencing the merged PR(s). The Yves dashboard tasks (KV cross-check, Cloudflare Rate Limiting) close their own issues independently when Yves runs them.
