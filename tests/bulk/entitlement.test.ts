import { describe, expect, it, beforeEach } from 'vitest';
import { isPro, lockPro, getStoredLicenseKey } from '@/lib/entitlement';

function setSearch(search: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    writable: true,
  });
}

describe('isPro / lockPro / getStoredLicenseKey', () => {
  beforeEach(() => {
    localStorage.clear();
    setSearch('');
  });

  it('returns false by default', () => {
    expect(isPro()).toBe(false);
  });

  it('returns true when ?pro=1 is in the URL', () => {
    setSearch('?pro=1');
    expect(isPro()).toBe(true);
  });

  it('persists pro status to localStorage when ?pro=1', () => {
    setSearch('?pro=1');
    isPro();
    expect(localStorage.getItem('plainvoice.pro')).toBe('1');
  });

  it('returns true from localStorage after page nav (no query param)', () => {
    setSearch('?pro=1');
    isPro();
    setSearch('');
    expect(isPro()).toBe(true);
  });

  it('lockPro() removes localStorage pro key', () => {
    setSearch('?pro=1');
    isPro();
    lockPro();
    setSearch('');
    expect(isPro()).toBe(false);
  });

  it('lockPro() also removes the stored license key', () => {
    localStorage.setItem('plainvoice.pro', '1');
    localStorage.setItem('plainvoice.pro.key', 'some-key');
    lockPro();
    expect(localStorage.getItem('plainvoice.pro.key')).toBeNull();
  });

  it('ignores ?pro=0', () => {
    setSearch('?pro=0');
    expect(isPro()).toBe(false);
  });

  it('getStoredLicenseKey() returns null when no key is stored', () => {
    expect(getStoredLicenseKey()).toBeNull();
  });

  it('getStoredLicenseKey() returns the stored key', () => {
    localStorage.setItem('plainvoice.pro.key', 'abc-123');
    expect(getStoredLicenseKey()).toBe('abc-123');
  });
});
