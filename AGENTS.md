# Working agreements — Plainvoice

Operational rules for any AI agent (Cowork PM/PO Claude, Code, or successor) working on this repo. Read on every session start. Update when a rule earns its place by costing real time.

## Roles

- **Cowork Claude (PM/PO)** — drafts handoff briefs in `docs/handoffs/`, reviews Code's PRs against the briefs, drives Stripe/Cloudflare/Resend dashboards via MCPs, owns release coordination. Does NOT write production code directly except for tiny doc/config patches.
- **Code (Claude Code)** — reads briefs, scaffolds, implements, tests, opens PRs. Owns code quality. Stays inside the assigned repo for the assigned phase.
- **Yves** — final say, runs commits/pushes locally, owns money/legal/account decisions (Stripe, OSS, lawyer review, bank).

## Handoff briefs

Process rule for Cowork PM → Code handoffs. Yves flagged repeated violations of this on 2026-04-29; the rule exists because the pattern was implicit and I kept slipping back to chat-inlined specs.

1. **Implementation specs go in the repo, not in chat.** Any work brief longer than ~10 lines — a multi-step implementation, an audit playbook, a triage doc, a phase plan — is written as a markdown file in `docs/handoffs/` (or `docs/security/` for security artifacts) and committed before Code is invoked. The Cowork → Code chat prompt is a SHORT pointer: "Read `<path>` and execute. Stop if any prerequisite is missing." Three reasons:
   - The brief survives Cowork session compaction; chat history does not.
   - Future agents (resumed sessions, new Cowork projects, second-pass reviewers) can re-read it.
   - The brief is reviewable / commentable in the repo before Code starts work.

2. **Naming convention.** Milestone handoffs use `NN-name.md` (e.g., `07-stripe-paywall.md`). Sub-phase or task briefs under a milestone use `Mx-purpose.md` (e.g., `M7-prelaunch-worker-hardening.md`). Audit artifacts (playbooks, reports, triage docs) live in `docs/security/` with date-stamped filenames where relevant.

3. **Exception: trivial one-step fixes.** If the work fits in one paragraph and one tool call (e.g., "add a missing label, push, done"), an inline instruction is fine. Threshold: if you'd need to copy-paste it again in a follow-up session to get the same result, write the file.

4. **Chat prompt shape is fixed.** Recommended model (see "Model selection" below), pointer to the brief, pointer to `AGENTS.md`, pointer to any prerequisite files or GitHub issues, optional setup/branch commands, "stop and ask" trigger conditions, "when done" reply format. Specifications belong in the brief, not the prompt.

5. **Code self-commits the handoff brief before executing.** This overrides Git-hygiene rule #1 for the specific case of files Cowork PM wrote to `docs/handoffs/` and named in the chat prompt. The motivation: Yves was tired of the manual commit cycle between "Cowork PM writes brief" and "Code reads brief." With this rule, Yves runs ONE command (the chat prompt) and Code handles brief commit + execution end-to-end. Procedure Code follows on first action:
   - Run `git status --short -- <exact brief path>` to confirm the brief is untracked or modified.
   - Run `git status --short` (whole repo) to confirm NO other unrelated changes are pending. If anything else shows up, STOP and ask Yves before committing — don't sweep up unrelated work.
   - Run `git checkout main && git pull origin main` first to ensure the commit lands on the latest tip.
   - `git add <exact brief path>` (no wildcards, no `git add -A`).
   - `git diff --cached --stat` and confirm only the brief is staged.
   - Commit with message `docs(handoff): <brief filename without extension>`, push to `origin/main`.
   - THEN read the brief and execute.

   This rule applies only to handoff briefs in `docs/handoffs/`. AGENTS.md edits, security audits, triage docs, and other non-brief tracked-file changes still follow Git-hygiene rule #1 (Yves commits manually).

6. **Always present the ready-to-paste chat prompt in the conversation — not just in the brief.** Even when the brief contains an embedded prompt as canonical reference, Cowork PM ALWAYS surfaces the ready-to-paste version in chat when handing off to Code. Yves operates in chat; he should never have to scroll through a 200-line brief to find his next action. Phrases like "the prompt is in the brief, take it from there" are forbidden. Always paste the prompt as a code block in the chat reply, even if it duplicates what's in the brief. The brief's embedded prompt serves as a permanent reference for future agents resuming the work; the chat-presented prompt serves Yves's immediate next click.

## Model selection

Every Code handoff declares the recommended model. Two places it appears:

- **The brief** has a "Model" line near the top (e.g., `Model: Claude Opus 4.6`).
- **The chat prompt** re-states it so Yves can launch Code with the right `--model` flag, or switch mid-session via `/model <name>` if he started on a different tier.

Default tiers for Plainvoice:

| Tier | Use for |
| --- | --- |
| **Opus** | Security review, payment code, license-issuance changes, multi-file refactors, audit playbook execution, anything touching the Worker's webhook / verify / KV writes. |
| **Sonnet** | Feature implementation, routine fixes, frontend UI work, test additions, doc updates. |
| **Haiku** | Trivial scripted tasks: label creation, mechanical find-and-replace, doc reformatting, batched `gh` calls from a list. |

When in doubt: default Sonnet, escalate to Opus mid-session if the task turns out harder than expected. Don't default Opus everywhere — cost compounds. Don't default Haiku for anything that touches application logic — quality drops.

If a brief doesn't specify a model, that's a Cowork PM bug; flag it back and pick from the table above based on the work's surface.

## Git hygiene

These rules exist because we hit divergence on the M7 P2 cleanup. They prevent it.

1. **`Edit` on a tracked file = a pending commit.** When Cowork Claude edits any tracked file in the workspace, the response that contains the edit MUST also include the exact `git add` + `git commit` command for Yves to run, and a reminder to push when convenient. No "no rush" wording — that's how drift starts.

2. **Push docs commits before merging the next PR.** If a PR is in flight, push any unrelated docs commits to `main` first. Otherwise the PR's branch (often based off Yves's local main) carries the unpushed content into a squash-merge, and local + origin diverge on the same file.

3. **Pull before opening a new branch.** Cowork Claude's bash bootstrap blocks for new branches MUST start with `git checkout main && git pull origin main`. No exceptions, even if "main was just pulled five minutes ago."

4. **Default to rebase, not merge, when reconciling local docs commits with origin.** `git pull --rebase`. Merges create unnecessary merge commits in a project where the only divergence should be docs vs. code.

5. **Worktree-aware branch deletion.** Squash-merged PRs delete the remote branch but the local branch needs `-D` (force) and any worktrees must be removed first via `git worktree remove --force <path>`. Cowork Claude includes the worktree-remove command preemptively.

6. **Never destroy work that exists only on Yves's machine without explicit confirmation.** `git reset --hard`, `git rebase --abort` after extensive work, `git push --force` — all require Yves to greenlight. The exception is when Cowork Claude has verified that origin has equivalent or newer content.

7. **Always switch to main + pull before any commit-push command targeting main.** Cowork PM commit commands that target `origin/main` MUST start with `git checkout main && git pull origin main && \`. Same expectation for Code per Handoff Briefs rule #5. Reason: after Code pushes a PR branch, Yves's local stays on that feature branch — running a commit then `git push origin main` from there lands the commit on the wrong branch and the push gets rejected. We've burned this twice (PR-1 cleanup + P3b cleanup, both 2026-04-30). The branch-check is a free three-word prefix; the recovery (cherry-pick + branch cleanup) is annoying.

## Code review verification

1. **Trust but verify.** Code's PR summary is what Code intended to do, not necessarily what landed. Cowork Claude reads the actual diff before delivering a verdict. If GitHub is unreachable from the sandbox, mount the repo via `request_cowork_directory`.

2. **Surface deviations from the brief explicitly.** When Code calls out a deviation in the PR body, treat that as the start of the review, not the end. Reason about whether the deviation is correct, document why in the verdict, and ask for an inline comment in the code if future contributors might un-do the deviation.

3. **Read the tests.** The brief's acceptance criteria are claims; the tests are evidence. Always read at least one test from each new spec area to confirm the assertion shape matches the requirement.

4. **Run lint + typecheck against the branch before approving.** Code's "all tests pass" claim is about tests; it is not a CI-pass claim. Lint and typecheck failures look invisible to a code-read review (unused vars, misplaced `@ts-expect-error`, etc.) but block CI. Cowork Claude runs at minimum `pnpm lint` and `pnpm typecheck` (or repo equivalents) on the PR branch before delivering an approve verdict. If the sandbox can't run them (missing node_modules, native deps don't resolve), say so in the verdict and either fix the sandbox or wait for Code to confirm CI green. Never approve a red-CI PR without an explicit "CI is failing because X, fix coming" rider.

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

## When to engage a real lawyer

Plainvoice ships v1 without an upfront lawyer review of AGB / Datenschutz (path-3 decision, 2026-04-27). Instead, AGB and Datenschutz were template-derived (**IT-Recht Kanzlei Starter Schutzpaket**, €9.90/mo, monthly cancellable, booked 2026-04-29 — Trusted Shops Legal was blocked because their signup is DACH-domicile only and we're a Dutch BV) and shipped **DE-only** (no EN legal pages — `/en/*` legal routes redirect to `/de/*`; product UI stays bilingual) behind beta framing + a generous refund stance. See `docs/handoffs/07-stripe-paywall.md` Phase 3 for the full rationale.

**Engage a Dutch/German e-commerce IT-Recht lawyer for a 1–2 hour formal review** (~€300–600 budget) when ANY of the following fires:

1. **First €1,000 in cumulative paid revenue** (across all customers, lifetime).
2. **First 25 paid customers** (across all customers, lifetime).
3. **First customer complaint, refund dispute, chargeback, or Abmahnung** (warning letter from a competitor, consumer protection org, or law firm) — whichever comes first.

The lawyer review is not optional once any tripwire fires. Don't argue with the rule by saying "it's a friendly customer" or "the complaint is silly." The point of the rule is that revenue + complaint volume both grow the legal blast radius, and at that point professional review is cheaper than its alternatives.

Until a tripwire fires, the operational policy is:

- **No-questions-asked refund within 30 days of purchase**, regardless of the AGB §6 waiver checkbox. Process via Stripe Dashboard.
- **No active enforcement of the §6 waiver.** A customer disputing within 14 days gets a refund without challenge.
- **Track every refund + complaint in `docs/operations/refund-log.md`** so the lawyer engagement (when it happens) starts from real data.

Open `docs/handoffs/09-lawyer-review.md` when a tripwire fires — that brief should describe the trigger, the questions for the lawyer, and the expected output.

## Memory

When the Cowork "Plainvoice" project is created, copy the rules above into project memory. Until then, this file is the source of truth.
