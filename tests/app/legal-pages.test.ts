import { describe, expect, it } from 'vitest';
import { COMPANY, LEGAL_LAST_UPDATED } from '@/lib/legal/company';
import deMessages from '@/i18n/messages/de.json';
import enMessages from '@/i18n/messages/en.json';

// Legal namespaces (Agb, Privacy, Widerruf) are DE-only — EN keys were
// dropped per the DE-only-legal-pages decision. Tests below only check
// DE for legal content; EN tests remain for non-legal namespaces.

describe('COMPANY constant', () => {
  it('has all required fields', () => {
    expect(COMPANY.legalName).toBeTruthy();
    expect(COMPANY.kvk).toBeTruthy();
    expect(COMPANY.vatId).toBeTruthy();
    expect(COMPANY.email).toBeTruthy();
    expect(COMPANY.streetAddress).toBeTruthy();
  });
});

describe('Impressum i18n — data consistency with COMPANY', () => {
  it('DE registerNumber contains COMPANY.kvk', () => {
    expect(deMessages.Impressum.registerNumber).toContain(COMPANY.kvk);
  });

  it('EN registerNumber contains COMPANY.kvk', () => {
    expect(enMessages.Impressum.registerNumber).toContain(COMPANY.kvk);
  });

  it('DE address contains COMPANY.streetAddress', () => {
    expect(deMessages.Impressum.address).toContain(COMPANY.streetAddress);
  });

  it('EN address contains COMPANY.streetAddress', () => {
    expect(enMessages.Impressum.address).toContain(COMPANY.streetAddress);
  });

  it('DE legalName matches COMPANY.legalName', () => {
    expect(deMessages.Impressum.legalName).toBe(COMPANY.legalName);
  });

  it('EN legalName matches COMPANY.legalName', () => {
    expect(enMessages.Impressum.legalName).toBe(COMPANY.legalName);
  });
});

describe('Privacy i18n (DE-only) — Stripe section present', () => {
  it('DE s5_2Body mentions Stripe', () => {
    expect(deMessages.Privacy.s5_2Body).toContain('Stripe');
  });

  it('DE privacy policy has at least 12 section headings', () => {
    const keys = Object.keys(deMessages.Privacy);
    const sectionHeadings = keys.filter((k) => k.endsWith('Heading'));
    // 12 top-level sections (s1–s12) + 4 sub-sections (s5_1–s5_4) = 16
    expect(sectionHeadings.length).toBeGreaterThanOrEqual(16);
  });
});

describe('AGB i18n (DE-only) — key structure', () => {
  it('DE AGB has at least 13 section headings', () => {
    const keys = Object.keys(deMessages.Agb);
    const headings = keys.filter((k) => /^s\d+\w*Heading$/.test(k));
    expect(headings.length).toBeGreaterThanOrEqual(13);
  });

  it('DE Widerruf withdrawal section contains COMPANY.email', () => {
    expect(deMessages.Widerruf.rightBody).toContain(COMPANY.email);
  });
});

describe('Footer i18n — three links present', () => {
  it('DE Footer has impressumLink, termsLink, privacyLink', () => {
    expect(deMessages.Footer.impressumLink).toBeTruthy();
    expect(deMessages.Footer.termsLink).toBeTruthy();
    expect(deMessages.Footer.privacyLink).toBeTruthy();
  });

  it('EN Footer has impressumLink, termsLink, privacyLink', () => {
    expect(enMessages.Footer.impressumLink).toBeTruthy();
    expect(enMessages.Footer.termsLink).toBeTruthy();
    expect(enMessages.Footer.privacyLink).toBeTruthy();
  });
});

describe('LEGAL_LAST_UPDATED', () => {
  it('is a YYYY-MM-DD string', () => {
    expect(LEGAL_LAST_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('is not in the future', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(LEGAL_LAST_UPDATED <= today).toBe(true);
  });
});
