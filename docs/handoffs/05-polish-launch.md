# M5 — Copy polish, launch prep, post-M4 cleanups

Final pass before public promotion of plainvoice.de. Small in surface area, mostly UX and SEO wiring, no new converter code. Two carried-over bugs from the M4 review ride along.

## Branch

```bash
git checkout main && git pull
git checkout -b m5-polish
```

## 1. Default output format → PDF

`src/components/Converter.tsx` currently initialises `useState<OutputFormat>('xlsx')`. Now that the PDF converter is shipped, PDF is the most universally openable output and the most useful first impression. Change the default:

```ts
const [format, setFormat] = useState<OutputFormat>('pdf');
```

## 2. Carried-over M4 review findings

### 2a. Translate allowance fallback labels

`src/lib/convert/pdf/sections/allowances.ts:22-25` falls back to the English literals `'Charge'` / `'Discount'` when `ac.reason` is empty. Wire this through `labels` instead:

```ts
// labels.ts — add inside the `pdf:` subsection of LabelBundle
allowanceFallback: string;
chargeFallback: string;
```

```ts
// labels.ts — DE
pdf: {
  // …existing…
  allowanceFallback: 'Rabatt',
  chargeFallback: 'Zuschlag',
}

// labels.ts — EN
pdf: {
  // …existing…
  allowanceFallback: 'Discount',
  chargeFallback: 'Charge',
}
```

In `allowances.ts`, replace the inline literal fallback with `labels.pdf.chargeFallback` / `labels.pdf.allowanceFallback`.

### 2b. Fix column-header overlap in PDF line-items table

**Symptom:** on a multi-page PDF, the "USt-Satz %" header column overlaps the "Einzelpreis" header to its left (the "U" renders on top of the "s" of Einzelpreis). Screenshot in M5 review thread.

**Cause:** `labels.columns.taxRate` is `'USt-Satz %'` (DE) / `'VAT rate %'` (EN). At 9pt Inter Bold these are roughly 52pt and 58pt wide, but the `taxPct` column is only 40pt wide (`COL_WIDTH.taxPct` in `src/lib/convert/pdf/layout.ts`). The right-aligned header text bleeds past the column's left edge into the unitPrice column. The per-row data ("19,00 %", "—") fits fine because it's much shorter than the label.

**Fix:** PDF-only short header labels. Keep the long form everywhere else (CSV and XLSX headers where column width is the reader's business, not ours).

Add a new subsection to `LabelBundle` in `src/lib/convert/labels.ts`:

```ts
pdf: {
  // …existing keys…
  columns: {
    taxPct: string;
    unitPrice: string;
  };
}
```

```ts
// DE
pdf: {
  // …existing…
  columns: {
    taxPct: 'USt %',
    unitPrice: 'Einzelpreis',   // unchanged label, kept as a PDF-owned override for future adjustability
  },
}

// EN
pdf: {
  // …existing…
  columns: {
    taxPct: 'VAT %',
    unitPrice: 'Unit price',
  },
}
```

In `src/lib/convert/pdf/sections/lines.ts`, `drawColumnHeader`, change the `text` values:

```ts
// was: text: C.unitPrice  →  text: labels.pdf.columns.unitPrice
// was: text: C.taxRate     →  text: labels.pdf.columns.taxPct
```

(Code can route `labels` into `drawColumnHeader` the same way the rest of the file accesses it.)

**Defensive guard** (small, worth adding): inside `drawColumnHeader`, after rendering, assert each header fits within its column width at the chosen font size. Log a dev-only `console.warn` if any header's measured width exceeds the column width; this catches future regressions when someone adds or translates a header.

```ts
function assertFits(label: string, font: PDFFont, size: number, width: number, columnName: string): void {
  if (process.env.NODE_ENV === 'production') return;
  const measured = font.widthOfTextAtSize(label, size);
  if (measured > width - 4 /* 2pt inset each side */) {
    console.warn(
      `[convertPdf] column header "${label}" (${measured.toFixed(1)}pt) exceeds ${columnName} width (${width}pt)`,
    );
  }
}
```

Call it for every header in `drawColumnHeader`. Doesn't fire in production; surfaces the problem immediately in dev and tests.

**Test:** add a unit test that constructs a fake PDF context with DE and EN bundles, calls a helper that returns `font.widthOfTextAtSize` for each header label, and asserts all are ≤ their column widths minus the 4pt total inset. Prevents this specific bug from recurring.

### 2c. Drop dead import in footer.ts

`src/lib/convert/pdf/sections/footer.ts` imports `USABLE_WIDTH` and has `void USABLE_WIDTH;` at line 31 to silence the unused-import warning. Remove both the import and the `void` statement.

## 3. Footer requirements line

New i18n key + render it in the footer below the existing copyright / privacy link.

### `src/i18n/messages/de.json` — under `Footer`

```json
"requirements": "Funktioniert in allen aktuellen Browsern. Keine Installation, kein Konto, keine Uploads."
```

### `src/i18n/messages/en.json` — under `Footer`

```json
"requirements": "Works in all modern browsers. No install, no account, no uploads."
```

### `src/app/[locale]/page.tsx`

In the `<footer>`, add a small line above the copyright row (or underneath — whichever reads better in the final layout; Code's call). The "keine Uploads" phrase is the single most important promise we make, so give it a little room — small `text-xs` or `text-sm`, muted colour, centered on mobile, left-aligned on desktop. Example shape:

```tsx
<footer className="flex flex-col items-center gap-3 border-t px-6 py-6 text-sm text-[color:var(--muted-foreground)] md:px-10">
  <p className="text-center text-xs md:text-sm">{tf('requirements')}</p>
  <div className="flex w-full flex-col items-center justify-between gap-3 md:flex-row">
    <span>{tf('copyright', { year: new Date().getFullYear() })}</span>
    <Link href={`/${locale}/datenschutz`} className="underline-offset-4 hover:underline">
      {tf('privacyLink')}
    </Link>
  </div>
</footer>
```

## 4. SEO / Open Graph / hreflang

`public/og.png` already exists. What's missing: OG tags in the metadata, sitemap, hreflang alternates. This matters as soon as we start promoting the URL anywhere.

### `src/app/[locale]/layout.tsx` — extend `generateMetadata`

```ts
export async function generateMetadata({ params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const baseUrl = 'https://plainvoice.de';
  const path = `/${locale}`;
  return {
    title: t('title'),
    description: t('description'),
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: path,
      languages: {
        de: '/de',
        en: '/en',
        'x-default': '/de',
      },
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      url: `${baseUrl}${path}`,
      siteName: 'Plainvoice',
      locale: locale === 'de' ? 'de_DE' : 'en_GB',
      type: 'website',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: t('title') }],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
      images: ['/og.png'],
    },
  };
}
```

Confirm `public/og.png` is 1200×630 or close; if it's a different aspect, update the `width`/`height` values to match the file. If it's smaller than 1200×630, flag it and we'll regenerate.

### `src/app/sitemap.ts` (new file)

Next.js App Router native sitemap generator, exported as default. Static export picks it up.

```ts
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://plainvoice.de';
  const now = new Date();
  return [
    { url: `${base}/de`, lastModified: now, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/en`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/de/datenschutz`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/en/datenschutz`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
```

### `public/robots.txt`

Add the sitemap reference:

```txt
User-agent: *
Allow: /

Sitemap: https://plainvoice.de/sitemap.xml
```

## 4b. Favicon + app icons

The current `src/app/favicon.ico` is a 99-byte placeholder from the M1 scaffold (it's actually a 32×32 PNG saved with a `.ico` extension — fine as a stopgap, wrong for launch).

Replace with a proper branded icon set. Next.js App Router picks these files up automatically when placed in `src/app/`:

- `src/app/icon.svg` — primary source, scales crisply on modern browsers.
- `src/app/icon.png` — 512×512, fallback for anything that can't render SVG favicons.
- `src/app/apple-icon.png` — 180×180, for iOS home-screen bookmarks.
- `src/app/favicon.ico` — multi-size ICO (16 + 32 + 48), for old Windows / legacy IE / edge cases.

Delete the current placeholder `favicon.ico` before generating the new one.

### Starter SVG

Use this as `src/app/icon.svg` — minimal letterform `P` on the Plainvoice accent colour (the same accent used in the PDF). Matches the Plain* aesthetic; no illustration, just the wordmark initial.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#333F8C"/>
  <text x="16" y="22" font-family="Inter, system-ui, -apple-system, sans-serif"
        font-weight="700" font-size="20" text-anchor="middle" fill="#ffffff">P</text>
</svg>
```

The hex `#333F8C` is the accent colour converted from `rgb(0.20, 0.25, 0.55)` in `src/lib/convert/pdf/layout.ts` — keeps favicon and PDF accent consistent.

### Generate the other sizes

Do this once at build-time-adjacent, not at runtime. Use `sharp` (already transitively installed via Next.js) or a one-off script. Preferred: a tiny Node script committed to `scripts/generate-icons.mjs` so it's reproducible, even though the outputs themselves are committed.

```js
// scripts/generate-icons.mjs
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import ico from 'png-to-ico';  // pnpm add -D png-to-ico

const svgPath = new URL('../src/app/icon.svg', import.meta.url);
const svg = await sharp(svgPath);

// 512x512 icon.png
await svg.clone().resize(512, 512).png().toFile('src/app/icon.png');
// 180x180 apple-icon.png
await svg.clone().resize(180, 180).png().toFile('src/app/apple-icon.png');
// favicon.ico — bundle 16/32/48 as multi-size ICO
const frames = await Promise.all(
  [16, 32, 48].map((size) => svg.clone().resize(size, size).png().toBuffer())
);
const icoBuffer = await ico(frames);
await writeFile('src/app/favicon.ico', icoBuffer);
```

Add a script entry in `package.json`:

```json
"scripts": {
  "icons": "node scripts/generate-icons.mjs"
}
```

Run `pnpm icons` once, commit the generated files. No build-time dependency — `png-to-ico` stays in `devDependencies`.

### Theme colour in metadata

Add to `generateMetadata` in `src/app/[locale]/layout.tsx` so the browser address bar tints on mobile:

```ts
themeColor: '#333F8C',
```

### Verify

After `pnpm build && pnpm start`, check:

- `curl -I http://localhost:3000/favicon.ico` returns 200 and the response is a real ICO (run `file` on the fetched bytes).
- `curl http://localhost:3000/` HTML includes `<link rel="icon" type="image/svg+xml" href="/icon.svg">` (Next's app-router auto-generated).
- Open the site in Chrome, Safari, and Firefox — each shows the branded tab icon. Open on iOS, add to home screen — the apple-icon shows.

## 5. Light Datenschutz improvements (holdover before M4.5)

The current `Privacy.body` is a single sentence. Expand to cover the three concrete facts a visitor needs: (1) no uploads, (2) no analytics, no cookies, no tracking, (3) hoster is easyname (Austria) and logs standard web-server access data temporarily for operational reasons.

### `src/i18n/messages/de.json` — replace `Privacy.body` with `Privacy.intro`, `Privacy.noUpload`, `Privacy.noTracking`, `Privacy.hosting`

```json
"Privacy": {
  "title": "Datenschutz",
  "intro": "Diese Anwendung verarbeitet Ihre Rechnung ausschließlich lokal in Ihrem Browser.",
  "noUpload": "Es werden keine Inhalte an Server übertragen — weder die XML-Datei noch die erzeugten CSV-, TXT-, XLSX- oder PDF-Ausgaben.",
  "noTracking": "Wir setzen keine Cookies, keine Analyse-Werkzeuge und kein Tracking ein. Schriftarten werden direkt von unserem Server ausgeliefert, nicht von einem externen CDN.",
  "hosting": "Die Website wird bei easyname GmbH (Österreich) gehostet. Der Hosting-Provider erfasst für den Betrieb technisch notwendige Zugriffsdaten (IP-Adresse, Zeitpunkt, abgerufene Ressource) in Logdateien; diese werden nach kurzer Zeit gelöscht.",
  "back": "Zurück"
}
```

### `src/i18n/messages/en.json`

```json
"Privacy": {
  "title": "Privacy",
  "intro": "This application processes your invoice entirely locally in your browser.",
  "noUpload": "No content is transmitted to any server — neither the XML file nor the generated CSV, TXT, XLSX, or PDF outputs.",
  "noTracking": "We use no cookies, no analytics, and no tracking. Fonts are served from our own server, not from a third-party CDN.",
  "hosting": "The site is hosted by easyname GmbH (Austria). The hosting provider records technically necessary access data (IP address, timestamp, requested resource) in log files for operational purposes; these are deleted after a short retention period.",
  "back": "Back"
}
```

### `src/app/[locale]/datenschutz/page.tsx`

Update the component to render four short paragraphs instead of one:

```tsx
const t = await getTranslations('Privacy');
// …
<article className="prose max-w-none">
  <h1>{t('title')}</h1>
  <p>{t('intro')}</p>
  <p>{t('noUpload')}</p>
  <p>{t('noTracking')}</p>
  <p>{t('hosting')}</p>
</article>
```

(Adjust classes to whatever's consistent with the current styling — no new CSS required.)

Note: this is a **stopgap** before the full Impressum + Datenschutzerklärung in M4.5. Don't remove the M4.5 backlog item.

## 6. Re-enable auto-deploy on push to main

`.github/workflows/deploy.yml` currently triggers only on `workflow_dispatch`. Now that FTPS is verified and two production deploys have succeeded, add the push trigger back:

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

Update the comment block to remove the "manually until we're ready" clause.

## 7. Clean up `comingSoonBadge` i18n key

`Converter.comingSoonBadge` is no longer used after M4. Grep to confirm no usages remain, then remove the key from both `de.json` and `en.json`.

## 8. Tests

No new converter tests. Add / update these:

- **`tests/app/metadata.test.ts`** — import the `generateMetadata` export (or test the rendered `<head>` via `next-intl` test utilities) and assert: `openGraph.images[0].url` is `/og.png`; `alternates.canonical` matches locale path; `alternates.languages.de` and `alternates.languages.en` are both set; `twitter.card` is `'summary_large_image'`.
- **`tests/app/sitemap.test.ts`** — import the default export from `src/app/sitemap.ts`, call it, assert it returns four entries with the expected URLs.
- **Existing PDF tests** — update anything that reads `labels.pdf.*` if relevant to the new `allowanceFallback` / `chargeFallback` keys. If `allowances.ts` isn't covered currently, add a narrow unit test that stubs an invoice with one allowance whose `reason` is empty and asserts the fallback string comes from the `labels` bundle (DE → `'Rabatt'`, EN → `'Discount'`).
- **i18n snapshot coverage** — if there's an existing test that walks message-key parity between `de.json` and `en.json`, rerun it; all new keys must exist in both.

`pnpm test` must stay green with coverage not regressing below the M4 numbers (94.6 % stmts).

## 9. Acceptance

- Landing loads with the PDF tile **selected by default**.
- Footer shows the requirements line on both locales.
- Generating a PDF for an invoice with a German locale and an empty-reason allowance shows `'Rabatt'` or `'Zuschlag'` (not `'Discount'` / `'Charge'`).
- `curl -I https://plainvoice.de/de` after deploy shows the expected meta tags in the HTML source; `curl https://plainvoice.de/sitemap.xml` returns the four URLs.
- View-source on the landing page includes `<link rel="alternate" hreflang="…">` for `de`, `en`, and `x-default`.
- `/datenschutz` renders four paragraphs covering processing, no-upload, no-tracking, and hosting.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass.
- A push to `main` after merge triggers the deploy workflow automatically.

## 10. Out of scope (NOT in M5)

- **Full Impressum + Datenschutzerklärung** — lands in M4.5 when Yves supplies the legal data. The M5 Datenschutz improvements above are a stopgap, not a replacement.
- **Analytics** — no Plausible, no Fathom, no anything. Launch clean; decide later.
- **Bulk conversion** — lands in M6.
- **New content sections** on the landing (benefits list, FAQ, screenshots) — intentionally kept minimal to match the Plain* aesthetic. If we want to add use-case framing later, it's a separate copy PR.

## 11. PR

- Title: `M5: copy polish, SEO, launch prep`
- Body: link back to this brief; list the 8 numbered sections above as a checklist; note that M4.5 (Impressum) remains parked.

## 12. Handoff to Cowork for review

Before you end the session:
1. Make sure the main checkout at `~/Documents/Codex/x-rechnung-conversion` is on `m5-polish` (not `main` or a worktree). `git -C ~/Documents/Codex/x-rechnung-conversion status` should show `On branch m5-polish`, clean tree.
2. Report the final commit SHA, branch name, and PR URL.
