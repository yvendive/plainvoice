# M7 launch-blocker fix — collapse Worker env split (single deployment)

**Model:** Claude Sonnet 4.6 — config-only change in `plainvoice-pay`. Two files touched, one commit.

## Symptom

Stripe webhook hits the OLD `plainvoice-pay` Worker (frozen at the pre-PR-2 code state). Latest code (PR #12 email Widerruf paragraph) and latest secrets (`RESEND_FROM_ADDRESS` with display name) live on a SEPARATE `plainvoice-pay-production` Worker that nothing routes traffic to. Confirmed via `wrangler tail` — events appear on the default worker, not the `--env production` one.

## Root cause

PR-2's CORS env-split introduced `[env.production.vars]` in `wrangler.toml` and changed `.github/workflows/deploy.yml` to `command: deploy --env production`. With Wrangler's default behavior, an `--env production` deploy creates a SEPARATELY-NAMED worker (`plainvoice-pay-production`) unless the env block has its own explicit `name = "..."`. Our env block didn't override the name, and we never updated the Stripe webhook URL to point at the new worker. Result: every deploy since PR-2 has gone to a worker that receives no traffic.

The `wrangler.toml` warnings Yves saw earlier (`vars.FRONTEND_URL not in env.production.vars`, `kv_namespaces not in env.production`) were Wrangler trying to tell us this exact thing.

## Setup (Code follows in this exact order)

**This brief lives in the frontend repo. The actual code changes are in the Worker repo.** Two-repo handoff:

1. `cd ~/Documents/Codex/x-rechnung-conversion`. Read AGENTS.md.
2. Per AGENTS.md "Handoff briefs" rule #5, commit and push THIS brief at `docs/handoffs/M7-fix-worker-env-split.md` to `origin/main` of the **frontend repo** before doing anything else. Standard procedure: `git status --short -- <brief path>` to confirm only the brief is pending, full `git status --short` to confirm no unrelated changes; if anything else is dirty, STOP and ask Yves.
3. THEN switch repos: `cd ~/Documents/Codex/plainvoice-pay && git checkout main && git pull origin main && git checkout -b fix-worker-env-split`.
4. Apply the two changes below in the Worker repo.

## Fix — collapse to a single deployment

The CORS env-split was a nice-to-have safety net (production allows only `plainvoice.de`, dev allows localhost too), but it's caused more pain than it's worth. Simplest fix: drop the env-split entirely and make production CORS strict at the top level. Dev/preview rarely needs CORS — local Next.js dev typically calls a locally-running `wrangler dev` Worker, not production.

Two file changes, one commit, in the **Worker repo**.

### Change 1 — `wrangler.toml`

Replace the existing `[vars]` and `[env.production.vars]` blocks with a single strict-production `[vars]` block:

**Current (broken split):**
```toml
[vars]
FRONTEND_URL = "https://plainvoice.de"
ALLOWED_ORIGINS = "https://plainvoice.de,http://localhost:3000"

[env.production.vars]
ALLOWED_ORIGINS = "https://plainvoice.de"
```

**Replace with:**
```toml
[vars]
FRONTEND_URL = "https://plainvoice.de"
ALLOWED_ORIGINS = "https://plainvoice.de"
```

Production CORS now strict by default. The `[env.production]` block disappears entirely — no env-split, single deployment. The KV namespace blocks at top level stay as-is (they were correct).

### Change 2 — `.github/workflows/deploy.yml`

In the "Deploy to Cloudflare" step, change `command: deploy --env production` to just `command: deploy`. Single line edit:

```yaml
      - name: Deploy to Cloudflare
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: deploy
```

That's it. After this commit lands on main, the next deploy goes to the original `plainvoice-pay` worker — the one Stripe webhook actually points at — with the latest code from main (which includes PR #12's email Widerruf paragraph).

## Hard rules

- **One commit, one PR.** Don't bundle other changes.
- `pnpm lint && pnpm typecheck && pnpm test` should still pass — neither file is application code; tests are unaffected.
- **Do not touch the existing CORS test** (`test/routes.cors.test.ts`). It tests middleware behavior against constructed env objects, not against `wrangler.toml`. It'll pass unchanged.
- **Do not touch any application code** (`src/**`). The fix is config-only.
- **Do not delete the orphaned `plainvoice-pay-production` worker.** That's a Yves dashboard cleanup task post-merge.

## When done

Reply with branch + PR URL. Yves squash-merges, deploy fires, and **then Yves has follow-up dashboard work** (described below) before re-testing.

## Yves follow-up after merge (NOT Code's task)

1. **Wait ~90 sec for the deploy to land.**
2. **Verify the webhook now reaches a fresh worker:**
   ```bash
   pnpm wrangler tail --format pretty
   ```
   (no `--env` flag — listening on the default-named worker now)
3. **Re-set `RESEND_FROM_ADDRESS` at default scope** — your earlier secret update went to the orphaned production-named worker, so the default-named worker still has the original bootstrap value. Run:
   ```bash
   pnpm wrangler secret put RESEND_FROM_ADDRESS
   ```
   (no `--env` flag — sets at default scope)

   Paste:
   ```
   Plainvoice Pro <noreply@plain-cards.com>
   ```

4. **Re-test the buy flow** with `4242 4242 4242 4242`. The next email should now show:
   - Inbox sender: `Plainvoice Pro` (not `noreply`)
   - Header from-line: `Plainvoice Pro <noreply@plain-cards.com>`
   - Widerruf paragraph between the activate-CTA and the footer HR
5. **Optional housekeeping (anytime):** delete the orphaned `plainvoice-pay-production` worker via Cloudflare dashboard → Workers & Pages → find `plainvoice-pay-production` → Manage → Delete. Or via CLI:
   ```bash
   pnpm wrangler delete --name plainvoice-pay-production
   ```
   This is purely tidying — the orphan worker gets no traffic, costs nothing, but it's mental clutter.

## Why this approach (notes for the future)

The env-split pattern in Wrangler is genuinely useful when you have multiple deployment targets (staging vs production, multiple regions, etc.). For a single-environment setup like Plainvoice's, the split adds risk for negligible benefit. If we ever want multi-env later, we'd do it properly: explicit `name` overrides per env, full inheritance via duplicated `[env.X.vars]` and `[[env.X.kv_namespaces]]` blocks, separate webhook URLs per env. Today's fix removes the half-implemented split that bit us.
