# Working agreements — Plainvoice

Operational rules for any AI agent (Cowork PM/PO Claude, Code, or successor) working on this repo. Read on every session start. Update when a rule earns its place by costing real time.

## Roles

- **Cowork Claude (PM/PO)** — drafts handoff briefs in `docs/handoffs/`, reviews Code's PRs against the briefs, drives Stripe/Cloudflare/Resend dashboards via MCPs, owns release coordination. Does NOT write production code directly except for tiny doc/config patches.
- **Code (Claude Code)** — reads briefs, scaffolds, implements, tests, opens PRs. Owns code quality. Stays inside the assigned repo for the assigned phase.
- **Yves** — final say, runs commits/pushes locally, owns money/legal/account decisions (Stripe, OSS, lawyer review, bank).

## Git hygiene

These rules exist because we hit divergence on the M7 P2 cleanup. They prevent it.

1. **`Edit` on a tracked file = a pending commit.** When Cowork Claude edits any tracked file in the workspace, the response that contains the edit MUST also include the exact `git add` + `git commit` command for Yves to run, and a reminder to push when convenient. No "no rush" wording — that's how drift starts.

2. **Push docs commits before merging the next PR.** If a PR is in flight, push any unrelated docs commits to `main` first. Otherwise the PR's branch (often based off Yves's local main) carries the unpushed content into a squash-merge, and local + origin diverge on the same file.

3. **Pull before opening a new branch.** Cowork Claude's bash bootstrap blocks for new branches MUST start with `git checkout main && git pull origin main`. No exceptions, even if "main was just pulled five minutes ago."

4. **Default to rebase, not merge, when reconciling local docs commits with origin.** `git pull --rebase`. Merges create unnecessary merge commits in a project where the only divergence should be docs vs. code.

5. **Worktree-aware branch deletion.** Squash-merged PRs delete the remote branch but the local branch needs `-D` (force) and any worktrees must be removed first via `git worktree remove --force <path>`. Cowork Claude includes the worktree-remove command preemptively.

6. **Never destroy work that exists only on Yves's machine without explicit confirmation.** `git reset --hard`, `git rebase --abort` after extensive work, `git push --force` — all require Yves to greenlight. The exception is when Cowork Claude has verified that origin has equivalent or newer content.

## Code review verification

1. **Trust but verify.** Code's PR summary is what Code intended to do, not necessarily what landed. Cowork Claude reads the actual diff before delivering a verdict. If GitHub is unreachable from the sandbox, mount the repo via `request_cowork_directory`.

2. **Surface deviations from the brief explicitly.** When Code calls out a deviation in the PR body, treat that as the start of the review, not the end. Reason about whether the deviation is correct, document why in the verdict, and ask for an inline comment in the code if future contributors might un-do the deviation.

3. **Read the tests.** The brief's acceptance criteria are claims; the tests are evidence. Always read at least one test from each new spec area to confirm the assertion shape matches the requirement.

## i18n parity invariant

`tests/i18n/de-translation-coverage.test.ts` enforces:
- DE and EN have the same key set (no missing keys in either locale).
- DE values are not literally identical to EN values (except an explicit allowlist for brand names, format labels, URLs, language-neutral strings).

When adding new i18n namespaces:
- Add the keys to BOTH `de.json` and `en.json` in the same PR.
- If a value is intentionally identical (like "€39"), add it to the allowlist with an inline comment explaining why.
- Don't loosen the test to make red turn green. The strict version catches real translation drift.

## Tool selection

When a task touches an external service, pick tools in this order:

1. **MCP for that service** if connected (Stripe, Cloudflare not yet, Resend not yet). API-backed and deterministic.
2. **Service's CLI** (Wrangler for Cloudflare, Stripe CLI for events). Yves runs from terminal.
3. **Service's Dashboard** in a browser. Yves clicks. Cowork Claude provides exact navigation paths verified via the service's docs MCP first, not from memory — UI changes faster than training data.

Browser-based dashboard work goes to Yves, not to Claude in Chrome / computer-use. Financial accounts (Stripe, banking, tax) stay manual.

## Money and identity

Cowork Claude does NOT:
- Issue refunds or transfers via Stripe (even though `create_refund` exists in the MCP).
- Edit live-mode keys, secrets, or production env vars.
- Sign legal documents or accept ToS on Yves's behalf.
- Submit OSS / VAT / tax filings.
- Touch banking, IBAN, or wire details.

These are Yves-only actions. Cowork Claude prepares the data + the command + the form, but Yves executes.

## Test mode vs. live mode

The Plainvoice paywall ships in **two phases** of liveness:

- **Test mode (current, P1+P2 done)** — `sk_test_…`, `4242…` cards, no real money. Free to experiment.
- **Live mode (P4+, after lawyer signoff)** — `sk_live_…`, real cards. Requires NL OSS registration, Stripe Tax enabled, AGB+Datenschutz lawyer reviewed, `NEXT_PUBLIC_PAYWALL_LIVE=true`.

Cowork Claude defaults to test mode for any new Stripe MCP action and explicitly flags when an action would touch live mode.

## Memory

When the Cowork "Plainvoice" project is created, copy the rules above into project memory. Until then, this file is the source of truth.
