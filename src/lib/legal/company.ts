export const COMPANY = {
  legalName: 'YS Development B.V.',
  legalForm: 'Besloten Vennootschap',
  streetAddress: 'Prins Hendrikplein 8',
  postalCode: '2264 SL',
  city: 'Leidschendam',
  country: 'Netherlands',
  countryDe: 'Niederlande',
  director: 'Yves Schulz',
  email: 'info@plain-cards.com',
  kvk: '93236867',
  vatId: 'NL866322887B01',
} as const;

/**
 * Bump this whenever the AGB or Datenschutz text changes (NOT for
 * code changes to the legal pages, only for text content).
 * ISO date string YYYY-MM-DD.
 */
export const LEGAL_LAST_UPDATED = '2026-04-30';
