import { describe, expect, it } from 'vitest';
import { COMPANY } from '@/lib/legal/company';
import deMessages from '@/i18n/messages/de.json';
import enMessages from '@/i18n/messages/en.json';

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

describe('Privacy i18n — Stripe section present', () => {
  it('DE s6Body mentions Stripe', () => {
    expect(deMessages.Privacy.s6Body).toContain('Stripe');
  });

  it('EN s6Body mentions Stripe', () => {
    expect(enMessages.Privacy.s6Body).toContain('Stripe');
  });

  it('DE privacy policy has 11 sections', () => {
    const keys = Object.keys(deMessages.Privacy);
    const sectionHeadings = keys.filter((k) => k.endsWith('Heading'));
    expect(sectionHeadings.length).toBeGreaterThanOrEqual(11);
  });

  it('EN privacy policy has 11 sections', () => {
    const keys = Object.keys(enMessages.Privacy);
    const sectionHeadings = keys.filter((k) => k.endsWith('Heading'));
    expect(sectionHeadings.length).toBeGreaterThanOrEqual(11);
  });
});

describe('AGB i18n — key structure', () => {
  it('DE AGB has 13 section headings', () => {
    const keys = Object.keys(deMessages.Agb);
    const headings = keys.filter((k) => /^s\d+Heading$/.test(k));
    expect(headings).toHaveLength(13);
  });

  it('EN AGB has 13 section headings', () => {
    const keys = Object.keys(enMessages.Agb);
    const headings = keys.filter((k) => /^s\d+Heading$/.test(k));
    expect(headings).toHaveLength(13);
  });

  it('DE AGB withdrawal section contains COMPANY.email', () => {
    expect(deMessages.Agb.s6RightBody).toContain(COMPANY.email);
  });

  it('EN AGB withdrawal section contains COMPANY.email', () => {
    expect(enMessages.Agb.s6RightBody).toContain(COMPANY.email);
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
