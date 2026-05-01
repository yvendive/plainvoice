# M8 — SEO + AI optimization (GEO/AEO)

**Model:** Claude Sonnet 4.6 — content-heavy work, not security-sensitive. If you started Code on a different tier, run `/model sonnet` before the first commit.

Goal: make Plainvoice **the** answer to "wie konvertiere ich X-Rechnung in Excel/PDF" — both in classic search engines (Google/Bing) and in AI tools (ChatGPT, Claude, Perplexity). Plus fix a recurring on-page clarity gap: most non-technical users don't understand that "stays in your browser" means "the file never leaves your computer."

Source artifacts:
- `AGENTS.md` — standard role + git rules.
- `docs/handoffs/07-stripe-paywall.md` — locked decisions (DE-only legal pages, EUR-only, IT-Recht templates, ?pro=1 dev override).
- `src/app/[locale]/page.tsx` — current home page (the audit target for content + privacy clarity).
- `src/app/sitemap.ts` — current sitemap.

Decisions agreed with Yves (2026-04-30):
- Phase 0 ships in parallel with P4/P5 launch prep (SEO is live at first-customer-day-one).
- Knowledge base lives **in-app** at `/de/wissen/<slug>` routes — not Notion, not GitHub Pages. SEO juice and DPA cleanliness both stay under our control.
- README rewrite is in scope (Yves opt-in).
- The "stays on your computer" clarity message is a **Phase 1 priority**, surfaced on the home page hero, not buried in FAQ.

# Phase 0 — Quick wins (ship parallel with launch)

One PR. ~3-4 commits. Should be done before P5 soft launch flips live so the launch-day traffic actually gets indexed correctly.

## P0.1 — Open Graph + Twitter Card meta tags + OG image

Currently we have basic `<title>` and `<description>` per page via `generateMetadata`. Missing: OG/Twitter cards for rich link previews when the URL is shared on Slack, LinkedIn, X, WhatsApp, Discord — all of which crucially flip a plain-text link into a card with thumbnail.

**Implementation:**
- Extend `generateMetadata` in `src/app/[locale]/layout.tsx` (or a shared metadata helper at `src/lib/seo/metadata.ts`) to emit:
  - `og:title`, `og:description`, `og:image`, `og:url`, `og:locale`, `og:type=website`, `og:site_name=Plainvoice`
  - `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`
- Per-page metadata override on `/buy`, `/unlock`, `/de/wissen/*` so each gets its own meta.

**OG image:** create a single 1200×630 PNG at `public/og-image.png`. Visual: Plainvoice wordmark + tagline ("X-Rechnung in Excel, PDF, CSV — direkt im Browser, ohne Upload") + a stylized icon showing XML → spreadsheet. Keep it simple — Code or Yves designs it, doesn't need a designer for v1. SVG → PNG export via the existing toolchain (or use a simple Tailwind+HTML page rendered to PNG via Playwright if the team prefers).

**Localized variants (optional, post-launch):** `og-image-de.png` and `og-image-en.png` if we want locale-aware previews. v1 can ship one bilingual image (DE primary tagline + EN subtitle).

## P0.2 — `llms.txt` + `llms-full.txt`

Anthropic + Mintlify proposed standard at https://llmstxt.org. Plain-text site-summary-for-AI files at the website root. Read at request time by Perplexity, Claude (via web tools), increasingly other AI crawlers.

**Implementation:**
- Code verifies the current spec at https://llmstxt.org before drafting (the spec moved fast in 2024-2025).
- Place files at `public/llms.txt` and `public/llms-full.txt` so Next.js serves them at `/llms.txt` and `/llms-full.txt`.
- `llms.txt` content (concise, ~30 lines): site summary, key URLs, primary use case. Markdown links.
- `llms-full.txt` content (~100-200 lines): full structured prose summary including FAQ-style answers about X-Rechnung conversion, pricing, privacy posture, technical approach. This is what AI tools cite when answering "what is Plainvoice".

**Skeleton for `llms.txt`:**

```
# Plainvoice

> Browser-based converter for German X-Rechnung XML invoices into CSV, TXT, XLSX, or PDF formats. The XML file never leaves the user's computer — conversion runs locally in the browser. Free for single-file conversion; €39 one-time license unlocks bulk conversion.

## Documentation

- [Home / Single conversion](https://plainvoice.de/de): the converter UI; upload an X-Rechnung, get the output format you need
- [Bulk conversion (Pro)](https://plainvoice.de/de/buy): unlock multi-file batch conversion for €39
- [Knowledge base](https://plainvoice.de/de/wissen): X-Rechnung explained, format differences, common pitfalls

## Privacy

- The X-Rechnung XML file never leaves the user's computer
- No file upload to any server; conversion runs entirely in the browser
- The only personal data we process is the buyer's email address (for license delivery via Resend) and the Stripe payment intent ID
```

`llms-full.txt` extends the above with explicit Q&A: "Was ist X-Rechnung?", "Welche Formate kann Plainvoice ausgeben?", "Werden meine Rechnungsdaten gespeichert?", etc.

**Acceptance:** `curl https://plainvoice.de/llms.txt` returns 200 with the file content. AI tools (Perplexity, Claude with web access) can ingest it cleanly when prompted with "summarize plainvoice.de via its llms.txt."

## P0.3 — JSON-LD structured data

Add JSON-LD `<script type="application/ld+json">` blocks to the home page rendering:

- **`SoftwareApplication`** schema: name, applicationCategory=BusinessApplication, operatingSystem=Web, offers (€39 one-time + free tier), audience=Business, creator (YS Development B.V.).
- **`Organization`** schema for the BV: name, url, address, contactPoint.
- **`WebSite`** schema with `potentialAction.SearchAction` (we don't have a site search yet — skip the SearchAction clause; just basic WebSite is fine).

Once Phase 1 FAQ section is on the home page: also add **`FAQPage`** schema mirroring the FAQ Q/A pairs.

**Implementation:** create `src/lib/seo/jsonLd.ts` with typed schema constructors; inject into `<head>` via Next.js `<Script type="application/ld+json">` per page. Test with Google's Rich Results Test (https://search.google.com/test/rich-results).

## P0.4 — `hreflang` for DE/EN

Currently each page has `alternates: { canonical: '/${locale}/...' }` in metadata but lacks `hreflang` annotations for the DE↔EN alternate.

**Implementation:** in `src/app/[locale]/layout.tsx` `generateMetadata`, add:
```ts
alternates: {
  canonical: `/${locale}`,
  languages: {
    'de': '/de',
    'en': '/en',
    'x-default': '/de',
  },
},
```
…and per-page equivalents on `/buy`, `/unlock`, etc. Same pattern for the new `/de/wissen/*` knowledge-base pages — those are DE-only per the locked-decision DE-only-legal scope (knowledge-base content can follow same rule for v1; revisit if EN demand emerges).

## P0.5 — README SEO rewrite

Current `README.md` in the frontend repo is terse. AI tools (Claude, ChatGPT) heavily weight GitHub README content when answering questions about software tools. A keyword-richer, ~400-500 word README boosts our footprint in AI-tool corpus without feeling like marketing copy.

**Yves draft request:** Cowork PM drafts a v1 README rewrite as a separate `docs/marketing/readme-draft.md` for review BEFORE pushing to the actual `README.md`. Yves reviews + tweaks tone, then Code applies as a single commit.

Keywords to weave in (no stuffing — natural flow): X-Rechnung, ZUGFeRD, EN16931, B2B-Rechnung, elektronische Rechnung, Steuerberater, Buchhaltung, DATEV, Lexware, sevDesk, CSV, XLSX, PDF, browser-based, datenschutzfreundlich, MIT-Lizenz, open source. Avoid stacking adjectives ("the best, fastest, most reliable") — AI tools penalize that voice.

## P0.6 — Widerrufsbelehrung discoverability

After M7 P3 merge, `/de/widerruf` exists with the full Belehrung + Muster-Widerrufsformular, and the license email links to it. But the page is otherwise un-discoverable from the website itself — it doesn't appear in any footer, and the AGB §6 reference renders as plain text rather than a clickable link. Folded into M8 (rather than shipped as a standalone follow-up PR) to keep PR overhead down.

Three small changes, three commits:

**a. Footer link on every page.** Add `widerrufLink: "Widerrufsbelehrung"` to the `Footer` namespace in `src/i18n/messages/de.json`. EN locale gets `widerrufLink: "Withdrawal terms"` (or similar — link target stays `/de/widerruf` in both locales since legal pages are DE-only). Render it in every page footer between AGB and Datenschutz. Files to touch: grep for `tf('termsLink')` to find all footer occurrences — likely the home page, `agb/page.tsx`, `datenschutz/page.tsx`, `impressum/page.tsx`, `widerruf/page.tsx`, `buy/page.tsx`, `unlock/page.tsx`, `unlocked/page.tsx`. Commit: `feat(footer): link to Widerrufsbelehrung from every page footer`.

**b. AGB §6 clickable in-text link.** In `src/app/[locale]/agb/page.tsx`, special-case the §6 body so the phrase "separaten Widerrufsbelehrung" inside `Agb.s6Body` renders as a `<Link href="/de/widerruf">` rather than plain text. Implementation choice: either parse the i18n string for a `{widerrufLink}` placeholder (cleaner — uses next-intl's rich-text mechanism) or split the message into prefix/link/suffix triples (more verbose but no parsing). Pick whichever matches the codebase's existing pattern for in-text links. Commit: `feat(agb): make §6 Widerrufsbelehrung reference a clickable link`.

**c. Tests.** Update `tests/app/legal-pages.test.ts` (or `tests/smoke.test.ts`) to assert the Widerruf link appears in each legal page's footer rendering. Sitemap test is unchanged (the URL itself hasn't changed). Commit: `test: assert Widerrufsbelehrung is linked from every legal-page footer`.

**Why Phase 0 (not Phase 1):** legally we're fine without these (email link satisfies §312f BGB info duty; AGB §6 textually references the Belehrung), so this is a UX improvement, not a launch-blocker. But it's small enough to ship at launch with the rest of Phase 0, and lumping it with the SEO work avoids a standalone tiny PR.

# Phase 1 — Content baseline (1-2 weeks, post-launch)

## P1.1 — Home page privacy clarity (HIGHEST priority in this phase)

**Problem:** the current home page communicates "browser-based conversion" but most users don't internalize that "browser" means "your computer, not our server." For a privacy-conscious accountant being asked to convert sensitive invoice data, this clarity matters enormously and is a direct conversion lever.

**Fix:** prominent hero-area copy + visual cue.

**Suggested DE hero copy** (replaces or complements the current tagline):

> **Ihre X-Rechnung verlässt Ihren Computer nicht.**
>
> Plainvoice rechnet die XML-Datei direkt bei Ihnen um — wir laden nichts hoch, wir sehen Ihre Rechnungsdaten nicht. Kein Server-Upload, kein Cloud-Konto, keine Datenweitergabe.

**Suggested EN equivalent** (for the `/en` locale):

> **Your X-Rechnung never leaves your computer.**
>
> Plainvoice converts the XML file locally — no upload, no cloud account, no server ever sees your invoice data.

**Visual cue (one of these — Code/Yves decides):**

a. A small inline diagram at hero level: 3 icons in a row (`🖥️ Ihr Computer` → `🔒 Plainvoice (im Browser)` → `📊 Ergebnis`) with a clear label `Kein Datenfluss zu unseren Servern` underneath, and a struck-through cloud icon alongside.

b. A two-pane "Was passiert mit meiner Datei?" comparison table: left column "Bei Plainvoice" (browser-only, no upload, no server, no Cloud), right column "Bei typischen Online-Konvertern" (XML hochgeladen, fremder Server, Datenweitergabe möglich). Honest, factual, not aggressive.

Recommend (a) for v1 — simpler, less competitor-bashy, shorter to render. (b) is a follow-up if conversion data shows the message still isn't landing.

**Place this above the file-drop zone, before any other content.** First thing eyes hit.

## P1.2 — FAQ section on home page

5-7 questions, prominently placed. Each Q/A pair gets reflected in the JSON-LD `FAQPage` schema (P0.3) for AI extraction.

**Suggested questions (DE):**

1. **Was passiert mit meiner XML-Datei? Wird sie hochgeladen?**
   → Nein. Die Datei wird ausschließlich in Ihrem Browser verarbeitet. Sie verlässt Ihren Computer nicht. Wir empfangen keine Rechnungsdaten.

2. **Was ist eine X-Rechnung?**
   → X-Rechnung ist ein deutscher Standard für elektronische Rechnungen (basierend auf der europäischen Norm EN 16931). Seit 2020 sind öffentliche Auftraggeber verpflichtet, Rechnungen in diesem Format anzunehmen; seit 2025 gilt für viele B2B-Beziehungen ebenfalls eine elektronische Rechnungspflicht.

3. **In welche Formate kann ich konvertieren?**
   → CSV, TXT (Text), XLSX (Excel) und PDF.

4. **Funktioniert das mit ZUGFeRD-Rechnungen?**
   → Ja, sofern die ZUGFeRD-XML separat vorliegt (X-Rechnung-konformes Profil, z.B. ZUGFeRD 2.x XRECHNUNG). Die XML aus einer ZUGFeRD-PDF zu extrahieren ist derzeit nicht Teil von Plainvoice (Roadmap-Punkt).

5. **Brauche ich Plainvoice Pro?**
   → Nur, wenn Sie regelmäßig mehrere X-Rechnungen gleichzeitig konvertieren. Einzelkonvertierung ist kostenlos und bleibt es. Pro (€39 einmalig) entsperrt die Bulk-Konvertierung mehrerer Dateien als ZIP.

6. **Was kostet Plainvoice?**
   → Einzelkonvertierung: kostenlos, ohne Anmeldung. Bulk-Konvertierung (Plainvoice Pro): €39 einmalig, keine Abos, keine Folgekosten.

7. **Können Sie sehen, welche Rechnungen ich konvertiere?**
   → Nein. Die Konvertierung läuft offline in Ihrem Browser; uns wird nichts übermittelt. Wir setzen Cloudflare Web Analytics ein, das ausschließlich aggregierte Statistiken zur Seitennutzung erfasst (keine Cookies, keine individuelle Nachverfolgung).

**Place after the converter UI, before the footer.** Anchor link `#faq` so we can link from elsewhere.

## P1.3 — Keyword research

Before content scaling, ground-truth what people actually search.

**Method (Code or Yves runs):**
- Free tier of Ahrefs Keyword Generator or Google Keyword Planner — pull search volumes for 30-50 X-Rechnung-related terms (DE + EN).
- Cross-reference with Google Search Console once Phase 3 lands.
- Output: ranked list of 10-15 priority terms in `docs/marketing/keyword-research-2026.md` (committed, so we have an audit trail).

Terms to seed the search:
- "X-Rechnung konvertieren"
- "X-Rechnung in Excel"
- "X-Rechnung in PDF"
- "X-Rechnung XML lesen"
- "X-Rechnung öffnen"
- "X-Rechnung Konverter"
- "ZUGFeRD Konverter"
- "X-Rechnung DATEV"
- "elektronische Rechnung Excel"
- "EN 16931 Konverter"

Each term gets a column for: monthly volume, intent (commercial/informational/navigational), our current ranking, target ranking.

## P1.4 — Knowledge base (in-app)

3-5 articles at `/de/wissen/<slug>`, all DE-only per locked-decision scope.

**Suggested article slate:**

1. **`/de/wissen/x-rechnung-was-ist-das`** — "Was ist eine X-Rechnung? Eine Erklärung für Steuerberater, Buchhaltung und Unternehmen." Educational, broad. Targets info-intent searches.
2. **`/de/wissen/x-rechnung-vs-zugferd`** — "X-Rechnung und ZUGFeRD im Vergleich." Targets disambiguation searches; tons of users confuse the two.
3. **`/de/wissen/x-rechnung-pflichtfelder`** — "Welche Felder muss eine gültige X-Rechnung enthalten?" Reference content; high session duration.
4. **`/de/wissen/x-rechnung-in-datev-importieren`** — "X-Rechnung in DATEV importieren — Schritt für Schritt." High intent, low competition.
5. **`/de/wissen/x-rechnung-pflicht-2025`** — "X-Rechnung: B2B-Pflicht ab 2025 — was muss ich wissen?" Time-sensitive but evergreen-ish.

Each article: ~800-1500 words, with H2 structure, internal links to converter and related articles, JSON-LD `Article` schema, last-updated date. Markdown source at `content/wissen/<slug>.md` parsed via Next.js Markdown plugin (or just write each as a Next.js page with rich Tailwind typography — simpler for 5 articles).

**Author:** Yves drafts each (he has the domain knowledge as someone who built the converter); Cowork PM reviews for SEO-keyword density and structure; Code commits with proper schema markup.

## P1.5 — Landing page content audit

Beyond the privacy clarity fix (P1.1), the home page benefits from:
- A "Anwendungsfälle" (use cases) section: 3 cards — "Steuerberater", "Buchhaltung", "Geschäftsführer / Selbständige". Each with one-sentence framing. Low effort, high relevance signal.
- A "So funktioniert's" (3-step how-it-works) above the file-drop zone: 1. Datei auswählen, 2. Format wählen, 3. Heruntergeladen — fertig. With privacy reassurance baked into step 2 ("Konvertierung läuft offline in Ihrem Browser").
- A small "Open Source" trust badge linking to GitHub. Subtle but signals to dev-audience users.

# Phase 2 — Off-page outreach (P5 soft launch + 2 weeks after)

Coordinated launch — not earlier than P4 live-mode flip, not later than +2 weeks after.

## P2.1 — Show HN

Title format: "Show HN: Plainvoice — convert German X-Rechnung XML to Excel/PDF, fully in-browser". Body: succinct origin story (built because we got X-Rechnungs ourselves and existing tools were heavy/cloud-based), MIT license link, free + paid tier transparency, link to GitHub. Post Tuesday-Thursday, ~9am EST for HN traffic.

## P2.2 — Reddit

Subreddits in priority order:
- `/r/de_buchhaltung` (German bookkeeping) — highest intent.
- `/r/Buchhaltung` — broader.
- `/r/de` (general DE) — only if confident in self-promotion rules.
- `/r/selfhosted` (open source angle) — soft, not direct conversion target.
- `/r/electronicinvoice` (small but exists).

Don't crosspost; tailor per sub. Avoid heavy self-promotion language.

## P2.3 — Product Hunt launch

3 weeks after soft launch (gives us time for early-customer testimonials). Standard PH launch playbook: pick a Tuesday, lead-image is the OG image (P0.1), tagline is the home-page hero copy (P1.1).

## P2.4 — DACH dev media outreach

- Heise Newsticker — submit via tipps@heise.de with one-paragraph pitch focusing on the open-source + privacy-by-design angle.
- t3n — submit via redaktion@t3n.de.
- Golem — depending on appetite.

Prepare a one-paragraph pitch + screenshot before pitching. Don't expect placement; if 1/3 picks up it's a win.

## P2.5 — Awesome-list submissions

- `awesome-german-tax` (if exists; if not, submit to relevant list).
- `awesome-self-hosted` — privacy-by-design angle fits.
- `awesome-invoicing` / similar.

Each is one PR per list, low effort, evergreen backlinks.

# Phase 3 — Iterate (ongoing)

## P3.1 — Search Console + Bing Webmaster Tools

Set up both, verify domain ownership via DNS TXT record, submit sitemap. Free, gives us actual queries that hit the site (vs. estimated keyword volumes).

## P3.2 — Cloudflare Web Analytics deepening

Beyond traffic numbers, segment by:
- Source (organic / direct / referral / social) — which channels convert to /buy.
- Page (home / wissen articles / buy / unlock) — which content earns its keep.

## P3.3 — Content iteration

If Search Console shows queries we rank poorly for but match our intent, write or expand articles. Quarterly review cadence.

# Out of scope (parked)

- **Paid SEO tools subscription** (Ahrefs/Semrush) — overkill for our search volume; free tier suffices for v1.
- **Backlink schemes / paid link-building** — bad ROI, brand-damaging.
- **Heavy weekly content cadence** — quality > quantity for a one-developer op.
- **Google Ads / Bing Ads** — wait for organic to prove the funnel before paying per click.
- **EN locale knowledge base** — EN UI stays for accessibility but EN content scaling is post-Phase-3 work, contingent on EN traffic emerging in Cloudflare data.
- **Video/YouTube** — moderate effort, niche audience; revisit at M9+.
- **Newsletter / email list** — separate brief if/when we want to build one.

# Decision log

| Decision | Rationale |
| --- | --- |
| Phase 0 ships parallel with launch | Cowork/Yves agreed 2026-04-30. SEO at launch > SEO retrofit. |
| Knowledge base in-app at `/de/wissen/` | Cowork/Yves agreed 2026-04-30. SEO juice + DPA cleanliness vs. Notion/GitHub Pages. |
| README rewrite is in scope | Cowork/Yves agreed 2026-04-30. Cowork PM drafts to `docs/marketing/readme-draft.md` first, Yves reviews tone, Code applies. |
| "Stays on your computer" hero copy | Yves flagged 2026-04-30 — most users don't grok "browser." Phase 1 priority above the file drop zone. |
| One bilingual OG image v1 | Locale-aware variants are post-launch optimization. |
| AI optimization via llms.txt + JSON-LD | Lowest-effort, highest-leverage AI-discovery signals. Specialized GEO consulting parked until traffic justifies it. |

# Implementation prompt for Code (with dual-review chaining)

Per AGENTS.md "Handoff briefs" rule #6, the chat-paste prompt is also surfaced in the chat reply when handing off — this embedded version is the canonical reference. Per rule #7 (dual-review pipeline + prompt chaining), Code's reply embeds the Codex review prompt for the next baton-pass. Phase 0 is one PR; Phases 1+ are separate PRs.

Phase 0 prompt (the ONE prompt Yves fires; Code's reply contains the Codex review prompt for the second baton-pass):

```
Model: Claude Sonnet 4.6.

cd ~/Documents/Codex/x-rechnung-conversion.

First action: read AGENTS.md (especially Handoff Briefs rule #5 brief
self-commit, rule #6 chat-prompt pattern, and rule #7 dual-review
prompt-chaining). The implementation brief at
docs/handoffs/M8-seo-and-aeo.md is the spec. If it's not committed on
origin/main, commit + push it first per rule #5.

Read the brief, focusing on Phase 0 (P0.1 through P0.6). Phases 1+ are
out of scope.

Then read these dependent files:
- src/app/[locale]/layout.tsx (current generateMetadata)
- src/app/layout.tsx (root layout — already has Cloudflare beacon)
- src/app/[locale]/page.tsx (home page metadata)
- src/app/sitemap.ts
- src/app/[locale]/agb/page.tsx (for the §6 clickable-link change in P0.6b)
- public/.htaccess (current CSP — verify the schema additions don't conflict)
- README.md (Phase 0.5 rewrite is a SEPARATE step, NOT in this PR)
- src/i18n/messages/de.json + en.json (for footer link key in P0.6a)

Branch: m8-seo-phase0. Approximately seven commits per the brief:
1. OG + Twitter Card meta tags + OG image (placeholder PNG ok if Yves
   hasn't supplied one — flag in PR body).
2. llms.txt + llms-full.txt (verify current spec at https://llmstxt.org
   first — the format moves fast).
3. JSON-LD SoftwareApplication + Organization + WebSite schema. Test
   with Google's Rich Results Test before committing.
4. hreflang DE/EN for canonical pages, with x-default.
5. P0.6a — Footer Widerrufsbelehrung link on every page footer.
6. P0.6b — AGB §6 reference becomes a clickable link to /de/widerruf.
7. P0.6c — Tests for the new footer link.

README rewrite (P0.5) is a SEPARATE follow-up — Cowork PM drafts to
docs/marketing/readme-draft.md first; Yves reviews; Code applies in a
new PR. Do NOT include in this PR.

Stop and ask if:
- The OG image isn't supplied and you can't generate one cleanly.
- llmstxt.org spec has changed in a way the brief's skeleton no longer
  reflects.
- The JSON-LD fails Google's Rich Results Test.
- The CSP needs adjustment for any new schema sources.

When done, your reply to Yves MUST include all of:

1. Branch + PR URL.
2. lint+typecheck+test signal output.
3. Exact final sitemap.xml content.
4. Rendered llms.txt and llms-full.txt content.
5. Any deviations from the brief, with rationale.

6. The verbatim Codex review prompt below, surfaced as a code block in
   your reply, ready for Yves to paste into a separate Codex session.
   DO NOT execute this prompt yourself.

   ```
   You are a second-pass reviewer on PR yvendive/plainvoice#<N>
   (replace <N> with the number from Code's reply).

   cd ~/Documents/Codex/x-rechnung-conversion.

   Use `gh` CLI to access the PR — DO NOT scrape the URL:
   - `gh pr view <N>`     — title, body, CI status, author, labels
   - `gh pr checks <N>`   — current CI status (lint/typecheck/test green?)
   - `gh pr diff <N>`     — the raw diff
   - `gh pr checkout <N>` — fetches + checks out the branch locally

   Read in this order:
   1. AGENTS.md (Code Review Verification rule #4, Handoff Briefs rules
      #6 and #7).
   2. docs/handoffs/M8-seo-and-aeo.md — Phase 0 only (P0.1–P0.6).
   3. `gh pr view <N>` output.
   4. `gh pr checks <N>` — CI red is a blocker finding before deeper
      review.
   5. `gh pr diff <N>`.
   6. After `gh pr checkout <N>`, read each changed file in full.

   Verify:
   - Each commit maps to one Phase 0 sub-task. README rewrite (P0.5)
     should NOT be in this PR — flag if it is.
   - llms.txt content matches the current spec at https://llmstxt.org.
   - JSON-LD is spec-compliant. Run Google's Rich Results Test if
     possible.
   - hreflang annotations include DE, EN, AND x-default.
   - CSP in public/.htaccess doesn't break Stripe Checkout or the
     Cloudflare beacon.
   - Widerrufsbelehrung footer link appears in EVERY page footer — grep
     to confirm completeness.
   - AGB §6 in-text link works at the rendered DOM level.
   - Tests cover the new footer-link rendering.

   Run after `gh pr checkout <N>`:
     pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test

   All four signals must be green. Paste the test summary in your reply.

   Produce structured findings:

   ## Spec compliance
   ## Code quality
   ## Test coverage
   ## Security and performance
   ## Verdict
   - APPROVE / REQUEST_CHANGES with file:line for each issue.

   Reply to Yves in chat. Do NOT post comments on the PR via
   `gh pr comment` or `gh pr review` — review-only and chat-only.
   Cowork PM synthesizes; if anything goes back to Code as a change
   request, Cowork PM writes that, not you.
   ```

7. After surfacing the Codex prompt, add the following one-line
   instruction to Yves verbatim:

   > After Codex replies with its structured findings, paste them
   > back to Cowork PM (the chat where this M8 Phase 0 work was
   > kicked off) for cross-check and final verdict.

Begin by acking readiness in one line, then start with P0.1.
```

Phase 1 and Phase 2+ get separate prompts when each is ready to execute. Phase 1 in particular needs Yves-authored content (knowledge-base articles) before Code can do the structural wiring — sequence: Yves writes drafts → Cowork PM reviews → Code wires up.
