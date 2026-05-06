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
