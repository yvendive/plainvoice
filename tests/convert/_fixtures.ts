import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseInvoice, type Invoice } from '@/lib/invoice';

export const FIXTURES = [
  'ubl-invoice-standard.xml',
  'cii-invoice-standard.xml',
  'ubl-credit-note.xml',
  'cii-mixed-rate.xml',
  'ubl-reverse-charge.xml',
] as const;

export type FixtureName = (typeof FIXTURES)[number];

export function loadFixture(name: FixtureName): Invoice {
  const xml = readFileSync(resolve(process.cwd(), 'samples', name), 'utf-8');
  const result = parseInvoice(xml);
  if (!result.ok) {
    throw new Error(`fixture ${name} did not parse: ${JSON.stringify(result.error)}`);
  }
  return result.invoice;
}
