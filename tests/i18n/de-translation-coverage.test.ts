import { describe, expect, it } from 'vitest';
import deMessages from '@/i18n/messages/de.json';
import enMessages from '@/i18n/messages/en.json';

// Namespaces that exist only in DE (legal pages are DE-only per the
// locked-decision in docs/handoffs/07-stripe-paywall.md). EN routes for
// these pages render DE translations directly — see the locale override
// in each legal page component.
const DE_ONLY_NAMESPACES: ReadonlyArray<string> = ['Agb', 'Privacy', 'Widerruf'];

// Keys where DE and EN are intentionally identical (proper nouns,
// format names, single-word technical labels).
const ALLOWED_IDENTICAL: ReadonlyArray<string> = [
  // Brand / product name
  'App.title',
  // Format labels — same word in both languages
  'Converter.confirmSyntax',   // "Format"
  'Converter.csvLayout',       // "Layout"
  'Converter.formatPdf',
  'Converter.formatXlsx',
  'Converter.formatCsv',
  'Converter.formatTxt',
  'Converter.csvCompatibilityModern',
  'Converter.csvCompatibilityLegacy',
  'Converter.csvSeparatorSemicolon',
  'Converter.csvSeparatorComma',
  'Converter.csvDecimalComma',
  'Converter.csvDecimalDot',
  'Converter.fileSize',
  // Copyright template — same punctuation / structure in both locales
  'Footer.copyright',
  // Proper noun (company name) and external URL — language-neutral
  'Impressum.legalName',
  'Impressum.odrLink',
  // Buy page: product name + price are language-neutral
  'Buy.title',       // "Plainvoice Pro"
  'Buy.priceAmount', // "€39"
];

function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else if (v && typeof v === 'object') Object.assign(out, flatten(v as Record<string, unknown>, key));
  }
  return out;
}

function isDeOnly(key: string): boolean {
  return DE_ONLY_NAMESPACES.some((ns) => key.startsWith(`${ns}.`));
}

describe('i18n parity DE/EN', () => {
  const de = flatten(deMessages as Record<string, unknown>);
  const en = flatten(enMessages as Record<string, unknown>);

  // Filter out DE-only legal namespaces for parity checks
  const deShared = Object.keys(de).filter((k) => !isDeOnly(k)).sort();
  const enShared = Object.keys(en).filter((k) => !isDeOnly(k)).sort();

  it('shared (non-legal) namespaces have the same key set in DE and EN', () => {
    expect(deShared).toEqual(enShared);
  });

  it('DE values are not the same as EN (except allowlist)', () => {
    const offenders: string[] = [];
    for (const key of deShared) {
      if (ALLOWED_IDENTICAL.includes(key)) continue;
      if (de[key] === en[key]) offenders.push(key);
    }
    expect(offenders).toEqual([]);
  });

  it('DE-only legal namespaces exist in DE', () => {
    for (const ns of DE_ONLY_NAMESPACES) {
      const keys = Object.keys(de).filter((k) => k.startsWith(`${ns}.`));
      expect(keys.length).toBeGreaterThan(0);
    }
  });
});
