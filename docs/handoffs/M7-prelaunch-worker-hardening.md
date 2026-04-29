# M7 pre-launch — Worker security hardening (PR-2)

Bundle of five Worker security fixes from the 2026-04-29 pre-launch pentest review. All five are launch-blockers; ship as one PR against `yvendive/plainvoice-pay`.

Source artifacts:
- [`../security/pentest-report-2026-04-29.md`](../security/pentest-report-2026-04-29.md) — full audit report.
- [`../security/pentest-issues-2026-04-29.md`](../security/pentest-issues-2026-04-29.md) — triage doc with issue specs.
- GitHub issues to close: `yvendive/plainvoice-pay#2`, `#3`, `#4`, `#5`, `#6`. Read each issue body before starting the corresponding fix — issue bodies contain the full acceptance criteria; this brief is the implementation order and bundling rules.

## Setup

1. `cd ~/Documents/Codex/plainvoice-pay`.
2. Read `~/Documents/Codex/x-rechnung-conversion/AGENTS.md`. Those rules apply to all Plainvoice work, including this repo.
3. `gh issue view 2 --repo yvendive/plainvoice-pay` (and 3, 4, 5, 6). Read all five before writing code.
4. `git checkout main && git pull origin main`.
5. `git checkout -b m7-prelaunch-worker-hardening`.

## Implementation order

Do the fixes in this sequence. Run `pnpm test` after each. One commit per fix.

### 1. `#2` — Regex pre-check on `/api/verify`

In `src/routes/verify.ts`, after the existing trim+lowercase normalization, add:

```ts
if (!LICENSE_KEY_PATTERN.test(normalized)) {
  return c.json({ valid: false }, 200);
}
```

Place BEFORE the `getLicense()` call. The response shape stays `{ valid: false }` so malformed and unknown keys are indistinguishable to a probing scanner.

Test (`test/routes.verify.test.ts`): malformed inputs (length 21, length 23, uppercase letters, special chars, non-string body) all return `{ valid: false }` AND the mock-KV `get()` is never called for these. Existing valid-key test still passes.

Commit message: `fix: enforce LICENSE_KEY_PATTERN before KV lookup on /api/verify (#2)`

### 2. `#5` — Pin Stripe `apiVersion`

In `src/lib/stripe.ts`, add `apiVersion: '<version>'` to the Stripe constructor. Source the version in this priority order:

1. Stripe Dashboard → Developers → API version, for account `acct_1TQrJMLJIGoQ4ULV`. If you have access, use this exact value.
2. If you can't reach the dashboard, use the latest stable Stripe API version your installed `stripe` npm package documents (check `node_modules/stripe/types/index.d.ts` or similar). Note in the commit message that the value should be cross-checked by Yves before merge.

Add a code comment above the constructor:

```ts
// Pinned API version. Upgrades require deliberate compatibility PR — see issue #5.
```

No new test required (constructor wiring is implicit in existing tests).

Commit message: `fix: pin Stripe apiVersion in client constructor (#5)`

### 3. `#4` — CORS env-scoped allowlist

In `wrangler.toml`:

- Move `ALLOWED_ORIGINS` out of the top-level `[vars]` block.
- Add `[env.production].vars` with `ALLOWED_ORIGINS = "https://plainvoice.de"`.
- Keep a default vars block (top-level `[vars]` or `[env.dev].vars` per Wrangler convention) with `ALLOWED_ORIGINS = "https://plainvoice.de,http://localhost:3000"` for local/preview.

In `src/lib/cors.ts`: no logic change — the env-scoped var flows through identically.

In `.github/workflows/deploy.yml`: verify the deploy step uses `wrangler deploy --env production` (or whatever the equivalent invocation is for the env split). Update if missing.

Test (`test/routes.cors.test.ts`, new file or extend existing): with `ALLOWED_ORIGINS="https://plainvoice.de"` set, a request with `Origin: http://localhost:3000` is rejected (no `Access-Control-Allow-Origin` header for that origin).

Commit message: `fix: scope CORS allowlist to production origin only (#4)`

### 4. `#3` — Body size caps

Decide implementation shape: a small Hono middleware that reads `Content-Length`, compares against a route-specific max, returns 413 if exceeded. For requests without `Content-Length`, enforce the cap during stream read.

Per-route limits:
- `/api/checkout`: 4 KB (email + locale + consent fields).
- `/api/verify`: 256 B (single key field).
- `/api/webhook`: 64 KB (Stripe events typically <8 KB; allow headroom).

Place the middleware in a new file `src/lib/body-limit.ts`. Wire it into `src/app.ts` BEFORE the route handlers.

Tests:
- Per-route oversize body returns 413 without parse side effects.
- Missing `Content-Length` still enforces the cap.
- Realistic-size existing tests still pass.

Commit message: `fix: enforce per-route request body size caps (#3)`

### 5. `#6` — Webhook write order + bail-on-partial

In `src/routes/webhook.ts`, swap the KV write order: `PAYMENTS.put` first, then `LICENSES.put`.

Failure handling:
- If `PAYMENTS` write throws → return 500 with no further work (Stripe retries; no orphan).
- If `LICENSES` write throws AFTER `PAYMENTS` succeeds → log the orphan PI ID via `console.error` (no PII, just the PI) and return 500 (Stripe retries; the `PAYMENTS`-already-set check at the top of the next delivery handles idempotency).

Add a code comment for the documented LOW-finding accepted v1 risk:

```ts
// ACCEPTED v1 RISK: parallel webhook deliveries may both miss the PAYMENTS
// check before either write completes. Mitigation would require a Durable
// Object or compare-and-set primitive; deferred until post-launch metrics
// justify the cost. See docs/security/pentest-issues-2026-04-29.md
// "Findings not filed".
```

Test: simulate KV `LICENSES.put` failure post-`PAYMENTS.put`. Assert email is NOT sent and 500 is returned.

Commit message: `fix: write PAYMENTS before LICENSES to preserve idempotency invariant (#6)`

## Hard rules

- **One PR, one branch** (`m7-prelaunch-worker-hardening`). Do NOT split into five PRs.
- **One commit per fix**, in the order above. Five commits before push. Each commit message ends with `Closes #<num>` so GitHub auto-links and auto-closes on merge.
- **All existing tests pass after every commit**, not just at the end. If a commit breaks a test, fix that commit before moving to the next.
- **Do not modify files outside** `src/`, `test/`, `wrangler.toml`, and `.github/workflows/deploy.yml`. If a fix needs adjacent docs, flag it in the PR body — Cowork PM decides whether to include.
- **Do not change** Stripe webhook signature verification, license key generation, or Resend integration. They were verified clean in the audit.
- **Do not run** `pnpm audit fix` or `pnpm update`. Dep upgrades are separate PR (issue #8).
- **Do not run live network calls.** Tests use mocks throughout.
- **Do not push to main.** Push the branch, open the PR, link the five issues, request Yves's review.

## PR body template

```markdown
## What

Bundle of five Worker security fixes from the 2026-04-29 pre-launch pentest review.

Closes:
- yvendive/plainvoice-pay#2 — regex pre-check on /api/verify
- yvendive/plainvoice-pay#3 — body size caps on all three endpoints
- yvendive/plainvoice-pay#4 — CORS env-scoped allowlist (no localhost in prod)
- yvendive/plainvoice-pay#5 — Stripe apiVersion pinning
- yvendive/plainvoice-pay#6 — webhook PAYMENTS-before-LICENSES write order

Issue #9 (security regression test coverage) is addressed inline by the tests
in this PR; close as duplicate when this merges.

## How

[one paragraph per fix; reference each issue's checklist]

## Test plan

- [ ] `pnpm test` — all green
- [ ] All five issue acceptance criteria checklists complete
- [ ] No accidental changes outside `src/`, `test/`, `wrangler.toml`,
      `.github/workflows/deploy.yml`
- [ ] Stripe `apiVersion` value cross-checked against dashboard before merge
      (Yves confirms)

## Out of scope

- Cloudflare Rate Limiting Rules (yvendive/plainvoice-pay#10 — Yves dashboard task)
- KV namespace cross-check (yvendive/plainvoice-pay#7 — Yves dashboard task)
- Dev tooling dep upgrades (yvendive/plainvoice-pay#8 — separate PR post-launch)
```

## When done — reply to Yves with

- Branch name + PR URL.
- Output of `pnpm test` (full run, pass/fail counts).
- Confirmation that the `wrangler.toml` env split is correct (paste the diff for the `[env.*]` blocks).
- The Stripe `apiVersion` value used + how you sourced it (so Yves can cross-check the dashboard).
- Any deviations from this brief, with rationale.

## Stop and ask if

- The Stripe dashboard isn't reachable AND the `stripe` npm package types don't have an unambiguous "latest" — don't guess.
- A Hono middleware approach for body-size limits doesn't compose cleanly with the webhook's raw-body read for signature verification — explain the conflict, propose two options, wait.
- Any fix's tests reveal a deeper bug not in scope for this PR — file a follow-up issue, mention in PR body, do NOT expand this PR's scope.
