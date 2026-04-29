/**
 * Per-file XML size cap.
 *
 * Layered ON TOP of the existing 100 MB total bulk cap. The per-file
 * limit prevents a single pathological XML from freezing the user's
 * tab during conversion (parsing 5 MB of well-formed XML is bounded
 * work; parsing a 90 MB billion-laughs-style document is not).
 *
 * Enforced in two places — both BEFORE `file.text()` is called:
 *  - `src/components/Converter.tsx` (single-file flow)
 *  - `src/lib/bulk/collect.ts` (bulk flow, per file)
 *
 * Issue #17 — pre-launch pentest hardening.
 */
export const MAX_XML_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
