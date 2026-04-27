# M6 — Bulk conversion + scaffolded Pro gate

Adds multi-file conversion as Plainvoice's first paid feature. Payment provider is deferred to M7 — this milestone ships the **feature** and the **gate structure**, with a stub entitlement check that unlocks via a URL flag or localStorage. Free tier = 1 file (unchanged). Pro tier = 2+ files via multi-select, folder drop, or ZIP upload.

Single-file flow remains the default and is untouched.

## Branch

```bash
git checkout main && git pull
git checkout -b m6-bulk
```

## 1. Scope summary

**In scope:**
- Detect bulk input (2+ files, folder drop, or ZIP) and route to a bulk flow.
- New bulk UI: file list with per-file status, overall progress, combined ZIP download.
- `ProGate` component wrapping the bulk convert action, with stub `isPro()` check.
- ZIP unpacking in-browser via `fflate`.
- Folder drop via `DataTransferItem.webkitGetAsEntry()` recursion.
- Per-file error isolation (one bad XML doesn't kill the batch).
- i18n keys for all new copy (DE + EN).
- Unit + integration tests.

**Out of scope (save for M7):**
- Stripe integration, actual purchase flow.
- Server-side license-key verification.
- VAT / invoicing for purchases.
- Any wording implying a live purchase (the gate's "Buy" button is disabled + says "Coming soon").

## 2. Input pipeline

Three input vectors must normalise into a single `File[]`:

1. **Multi-select** — native `<input type="file" multiple>` and `<input type="file" webkitdirectory>` for the folder-picker fallback.
2. **Drag-drop** — detect `DataTransfer.items` vs `.files`. If any item is an entry with `isDirectory === true`, walk it recursively with `FileSystemDirectoryEntry.createReader()`.
3. **ZIP upload** — if a single `.zip` file is dropped, unpack with `fflate.unzip()` and wrap each entry as a `File`.

After gathering, filter:
- Keep only `*.xml` (case-insensitive, match on extension).
- Drop hidden / macOS cruft: `.DS_Store`, `__MACOSX/…`, anything starting with `._`.
- Enforce hard limits: **max 50 files**, **max 100 MB total**. Exceeding either shows an error and aborts the batch (doesn't partially load).

Put this logic in `src/lib/bulk/collect.ts`:

```ts
export interface BulkInputResult {
  files: File[];
  errors: BulkInputError[]; // e.g. "example.txt skipped (not XML)"
}

export async function collectFromDrop(dt: DataTransfer): Promise<BulkInputResult>;
export async function collectFromInput(list: FileList): Promise<BulkInputResult>;
export async function unzipXmlFiles(zipFile: File): Promise<BulkInputResult>;
```

Add `fflate` to dependencies (`pnpm add fflate`). It's ~8 KB gzipped — significantly smaller than JSZip and has a cleaner API.

## 3. Detection: when does bulk mode activate?

The existing `FileDropZone` receives one `File` at a time. Refactor it to receive a `File[]` and decide the flow:

- `files.length === 1 && !file.name.endsWith('.zip')` → single-file flow (existing behaviour, untouched).
- `files.length === 1 && file.name.endsWith('.zip')` → unpack first, then dispatch based on count.
- `files.length >= 2` → bulk flow.

`Converter.tsx` grows a second status branch: `kind: 'bulk-ready'`, `'bulk-generating'`, `'bulk-done'`. Keep the single-file reducer intact; add parallel cases rather than rewriting.

## 4. Pro gate

### 4a. Entitlement stub

`src/lib/pro/entitlement.ts`:

```ts
const KEY = 'plainvoice_pro';

export function isPro(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('pro') === '1') {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore quota / privacy mode */
    }
    return true;
  }
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function lockPro(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
```

`?pro=1` anywhere on the site flips the flag on and persists it. `lockPro()` is exposed for testing (and, later, for a "sign out" action when M7 ships).

**Security note:** this is a client-side check only, intentional. A determined user can bypass it by editing localStorage — that's fine, M7 adds the real server-side verification. The purpose here is the UX scaffold, not DRM.

### 4b. `ProGate` component

`src/components/ProGate.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { isPro } from '@/lib/pro/entitlement';
import { Button } from '@/components/ui/button';

interface ProGateProps {
  children: React.ReactNode;
}

export function ProGate({ children }: ProGateProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [mounted, setMounted] = useState(false);
  const t = useTranslations('ProGate');

  useEffect(() => {
    setUnlocked(isPro());
    setMounted(true);
  }, []);

  if (!mounted) return null; // avoid SSR hydration mismatch

  if (unlocked) return <>{children}</>;

  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-xl border bg-[color:var(--muted)] p-6 text-center">
      <h3 className="text-lg font-semibold">{t('title')}</h3>
      <p className="text-sm text-[color:var(--muted-foreground)]">{t('body')}</p>
      <p className="text-2xl font-semibold tracking-tight">{t('price')}</p>
      <Button size="lg" disabled>{t('ctaComingSoon')}</Button>
      <p className="text-xs text-[color:var(--muted-foreground)]">{t('availabilityHint')}</p>
    </div>
  );
}
```

Wraps the bulk convert button only. Single-file convert stays outside the gate.

### 4c. Gate placement

```
bulk list of files  (visible always once bulk detected)
   ↓
format picker       (visible always)
   ↓
<ProGate>
  convert button
  progress bar
</ProGate>
```

Rationale: user sees exactly what they'd be converting before hitting the paywall. Higher intent = better conversion later.

## 5. Bulk UI

New component `src/components/BulkFileList.tsx`:

Each row shows:
- Filename (truncated with `text-ellipsis`)
- Status: `queued` / `parsing` / `ready` / `error`
- Invoice number (once parsed) or error message (if failed)
- Size in KB

Status icons:
- queued: muted dot
- parsing: spinner
- ready: checkmark (`lucide-react` is not a dep; use inline SVG matching existing style)
- error: warning triangle + hover tooltip with error detail

Overall progress bar above the list: `${readyCount} / ${totalCount}`.

After bulk convert button is pressed:
- Convert each ready file sequentially (not parallel — avoids UI jank, keeps memory bounded).
- Update per-file status as each finishes.
- On completion, bundle all output blobs into a single ZIP with `fflate.zipSync()` and trigger download as `plainvoice-bulk-{YYYY-MM-DD}.zip`.
- Inside the ZIP, name each file `{invoice-number}.{ext}` (fall back to `file-{index}.{ext}` if number missing).

## 6. Error isolation

Parse errors for individual files must not kill the batch:

```ts
const results = await Promise.allSettled(files.map(parseFile));
// each result is either { ok: true, invoice, warnings } or { ok: false, error }
```

A file that fails parsing shows as `error` row with the parse error message — but the batch continues with the valid files. At conversion time, skip error rows.

If **all** files fail → show an ErrorCard explaining "None of these files could be read" + offer reset.

If **some** files fail → proceed to ZIP download with the successful ones, and prepend a `_errors.txt` entry inside the ZIP listing failed filenames and reasons.

## 7. i18n keys

Add to `src/i18n/messages/de.json` and `en.json`:

```json
"Bulk": {
  "title": "…",          // DE: "Mehrere Rechnungen" / EN: "Bulk conversion"
  "detected": "…",        // DE: "{count} Dateien erkannt." / EN: "{count} files detected."
  "tooMany": "…",         // DE: "Maximal 50 Dateien pro Vorgang." / EN: "Maximum 50 files per batch."
  "tooLarge": "…",        // DE: "Zusammen maximal 100 MB." / EN: "Maximum 100 MB combined."
  "unzipping": "…",       // DE: "ZIP wird entpackt …" / EN: "Unzipping…"
  "fileStatusQueued": "…",
  "fileStatusParsing": "…",
  "fileStatusReady": "…",
  "fileStatusError": "…",
  "progress": "…",        // "{ready} von {total} bereit" / "{ready} of {total} ready"
  "convertAll": "…",      // "Alle konvertieren" / "Convert all"
  "downloadAll": "…",     // "Alle als ZIP herunterladen" / "Download all as ZIP"
  "partialErrorsNote": "…", // "Einige Dateien konnten nicht gelesen werden (siehe _errors.txt)." / "Some files couldn't be read (see _errors.txt)."
  "allFailed": "…"        // "Keine der Dateien konnte gelesen werden." / "None of the files could be read."
},
"ProGate": {
  "title": "…",           // DE: "Pro-Funktion" / EN: "Pro feature"
  "body": "…",            // DE: "Bulk-Konvertierung ist Teil von Plainvoice Pro — für alle, die regelmäßig viele Rechnungen verarbeiten." / EN: "Bulk conversion is part of Plainvoice Pro — for anyone processing many invoices regularly."
  "price": "…",           // DE: "€39 einmalig" / EN: "€39 one-time"
  "ctaComingSoon": "…",   // DE: "Bald verfügbar" / EN: "Coming soon"
  "availabilityHint": "…" // DE: "Startet in den nächsten Wochen. Kein Abo, keine wiederkehrenden Kosten." / EN: "Launching in the coming weeks. No subscription, no recurring fees."
}
```

Exact copy in the JSON — don't over-engineer the wording, keep it direct.

## 8. Tests

Four new files in `tests/bulk/`:

1. **`collect.test.ts`** — `collectFromInput` with mixed `.xml` and `.txt` → only `.xml` survives, `.txt` appears in `errors`. Enforce 50-file and 100 MB limits.
2. **`unzip.test.ts`** — synthetic ZIP with two XMLs + one `.DS_Store` → two XMLs returned, cruft filtered. Use `fflate.zipSync` to build the ZIP in-test.
3. **`entitlement.test.ts`** — default locked; `?pro=1` unlocks and persists; `lockPro()` relocks. Mock `window.location.search` + `localStorage`.
4. **`bulk-flow.test.ts`** — integration: 3 fixture XMLs, one deliberately corrupt → bulk conversion produces ZIP with 2 successful outputs + `_errors.txt` listing the third.

Existing single-file tests must remain green (188/188 or higher — don't break ground truth).

## 9. Footer copy touch

While this ships, update the footer to subtly signal the Pro tier exists without being pushy:

```json
"Footer.requirements": "Works in all modern browsers. No install, no account, no uploads."
```

Stays as-is. **Don't add a "Pro" nav link yet** — the gate shows up contextually when the user drops 2+ files. Keeping the free-tier hero clean.

## 10. Accessibility

- File list: each row is `role="listitem"`, status icon has `aria-label` matching the status text.
- Progress bar: `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-valuetext` for screen readers.
- Gate card: `role="region"` with `aria-label={t('title')}`.
- Disabled "Coming soon" button: native `disabled` attribute (no `aria-disabled` workaround — we want it unfocusable).

## 11. Acceptance

- [ ] Drop 2+ XML files → bulk list appears, gate shows "Pro feature" card with disabled CTA.
- [ ] Navigate with `?pro=1` → gate passes through; convert button enabled.
- [ ] Click convert → per-file status updates, ZIP downloads with all outputs.
- [ ] Drop a folder containing 5 XMLs (+ a `.DS_Store`) → only the XMLs are picked up.
- [ ] Drop a ZIP containing 3 XMLs → ZIP unpacked, bulk list shows 3 files.
- [ ] Drop 51 files → error "Maximum 50 files per batch.", batch aborted.
- [ ] Drop 3 XMLs where one is corrupt → ZIP contains 2 outputs + `_errors.txt`.
- [ ] Drop 1 XML → single-file flow unchanged, no gate.
- [ ] `pnpm lint` clean; `pnpm typecheck` clean; `pnpm test` all pass including 4 new tests; `pnpm build` clean.

## 12. Handoff back

```
M6 done: branch `m6-bulk`, commit <sha>, PR #<n>.
Tests: <before>/<before> → <after>/<after>.
Acceptance: all 9 checks pass.
Notes: <anything surprising>
```
