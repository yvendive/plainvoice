import { describe, expect, it } from 'vitest';
import deMessages from '@/i18n/messages/de.json';
import enMessages from '@/i18n/messages/en.json';

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

describe('i18n parity DE/EN', () => {
  const de = flatten(deMessages as Record<string, unknown>);
  const en = flatten(enMessages as Record<string, unknown>);

  it('DE and EN have the same key set', () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });

  it('DE values are not the same as EN (except allowlist)', () => {
    const offenders: string[] = [];
    for (const key of Object.keys(de)) {
      if (ALLOWED_IDENTICAL.includes(key)) continue;
      if (de[key] === en[key]) offenders.push(key);
    }
    expect(offenders).toEqual([]);
  });
});
