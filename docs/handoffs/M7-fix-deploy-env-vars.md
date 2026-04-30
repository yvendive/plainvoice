# M7 launch-blocker fix — deploy workflow missing build-time env vars

**Model:** Claude Sonnet 4.6 — single-file config fix.

**Symptom:** the production buy flow is broken. POST to `https://plainvoice.de/api/checkout` returns 404 from easyname Apache instead of hitting the Cloudflare Worker. Browser DevTools confirmed: the request is going to the wrong URL.

**Root cause:** `src/components/BuyForm.tsx:13` reads `NEXT_PUBLIC_WORKER_URL` with a `?? ''` fallback. The deploy workflow at `.github/workflows/deploy.yml` only passes `NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` at build time — `NEXT_PUBLIC_WORKER_URL` and `NEXT_PUBLIC_PAYWALL_LIVE` are absent. With both undefined at build, the static export bakes in empty strings, and the form's fetch URL collapses from `${WORKER_URL}/api/checkout` to `/api/checkout` (relative) → resolves to `https://plainvoice.de/api/checkout` → 404.

The buy flow has been silently broken on production since M7 P2 deployed — we'd only tested locally and via the deployed Worker (curl), never end-to-end through the deployed frontend.

**Side effect:** this also means the Critical paywall-bypass fix (#16) has been running in production with an implicit-undefined `PAYWALL_LIVE`. The behaviour is correct (undefined evaluates as not-live), but the value should be deterministic per deploy. Fix passes `'false'` explicitly.

## Setup

1. `cd ~/Documents/Codex/x-rechnung-conversion`.
2. Read `AGENTS.md`. Per "Handoff briefs" rule #5, commit and push this brief from working tree to `origin/main` before executing — standard procedure with the `git status --short` safety check.
3. `git checkout main && git pull origin main`.
4. `git checkout -b fix-deploy-env-vars`.

## The change

Edit `.github/workflows/deploy.yml`. Locate the "Build static export" step (currently around line 35-40). Add two lines to the `env:` block under `pnpm build`. Final state:

```yaml
      - name: Build static export
        env:
          NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN: ${{ secrets.CLOUDFLARE_ANALYTICS_TOKEN }}
          NEXT_PUBLIC_WORKER_URL: https://plainvoice-pay.yvendive.workers.dev
          NEXT_PUBLIC_PAYWALL_LIVE: 'false'
        run: pnpm build
```

Notes:
- `WORKER_URL` is a public URL — no secret needed. Hardcode it directly in the workflow.
- `PAYWALL_LIVE` stays `'false'` (string, quoted) until M7 P4 flip. Yves edits this line as part of the P4 workstream when going live with real Stripe keys.
- Don't touch any other field in the workflow.

## Commit + verify

One commit. Open the PR.

```bash
git add .github/workflows/deploy.yml
git commit -m "fix(deploy): pass NEXT_PUBLIC_WORKER_URL + PAYWALL_LIVE at build time"
git push origin fix-deploy-env-vars
gh pr create --title "fix(deploy): pass missing build-time env vars" \
  --body "Closes the production buy-flow 404 — see docs/handoffs/M7-fix-deploy-env-vars.md."
```

After Yves squash-merges the PR, the push to `main` triggers the deploy workflow (`on: push: branches: [main]`) automatically. Wait ~2 minutes for the FTPS deploy to easyname to complete.

## Verification (Yves runs after merge)

```bash
# 1. Confirm the deploy ran:
gh run list --repo yvendive/plainvoice --limit 1

# 2. View source on plainvoice.de/de/buy and confirm the bundled JS
#    references plainvoice-pay.yvendive.workers.dev (not just /api/checkout):
curl -s https://plainvoice.de/de/buy | grep -o "plainvoice-pay.yvendive.workers.dev" | head -1
```

If grep returns the URL, the env var made it into the build. Then re-test the actual buy flow with Stripe test card `4242 4242 4242 4242`.

## Hard rules

- One PR, one commit. Don't combine with anything else.
- `pnpm lint && pnpm typecheck && pnpm test` should still pass — but this change doesn't touch any tested code path, so signals will be unchanged.
- Don't modify the workflow's other steps (Setup pnpm / Install / Test / Deploy via FTPS).
- Don't switch `PAYWALL_LIVE` to anything other than `'false'`. The P4 brief is the one that flips it.

## When done

Reply with the branch name + PR URL. After Yves merges and the deploy lands, Yves verifies via the curl check above and re-tests the buy flow.
