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
