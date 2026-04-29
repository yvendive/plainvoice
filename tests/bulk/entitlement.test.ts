import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
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
    // Ensure each test in this block runs with paywall NOT live so the
    // existing dev/QA semantics of ?pro=1 keep working. Tests in the
    // PAYWALL_LIVE=true block below opt in explicitly.
    vi.stubEnv('NEXT_PUBLIC_PAYWALL_LIVE', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

describe('isPro — ?pro=1 URL override is gated on NEXT_PUBLIC_PAYWALL_LIVE (#16)', () => {
  beforeEach(() => {
    localStorage.clear();
    setSearch('');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('PAYWALL_LIVE=true: ?pro=1 does NOT unlock and does NOT write localStorage', () => {
    vi.stubEnv('NEXT_PUBLIC_PAYWALL_LIVE', 'true');
    setSearch('?pro=1');
    expect(isPro()).toBe(false);
    expect(localStorage.getItem('plainvoice.pro')).toBeNull();
  });

  it('PAYWALL_LIVE=false: ?pro=1 still unlocks (dev/QA path preserved)', () => {
    vi.stubEnv('NEXT_PUBLIC_PAYWALL_LIVE', 'false');
    setSearch('?pro=1');
    expect(isPro()).toBe(true);
    expect(localStorage.getItem('plainvoice.pro')).toBe('1');
  });

  it('PAYWALL_LIVE unset: ?pro=1 still unlocks (default behaviour is dev-friendly)', () => {
    // No stub for NEXT_PUBLIC_PAYWALL_LIVE — ensure it's unset
    vi.stubEnv('NEXT_PUBLIC_PAYWALL_LIVE', '');
    setSearch('?pro=1');
    expect(isPro()).toBe(true);
    expect(localStorage.getItem('plainvoice.pro')).toBe('1');
  });

  it('PAYWALL_LIVE=true: existing localStorage entitlement is honoured (paying customers stay unlocked after the flip)', () => {
    vi.stubEnv('NEXT_PUBLIC_PAYWALL_LIVE', 'true');
    localStorage.setItem('plainvoice.pro', '1');
    setSearch('');
    expect(isPro()).toBe(true);
  });

  it('PAYWALL_LIVE=true: ?pro=1 does NOT grant entitlement on top of empty localStorage', () => {
    vi.stubEnv('NEXT_PUBLIC_PAYWALL_LIVE', 'true');
    setSearch('?pro=1');
    expect(isPro()).toBe(false);
  });

  it('lockPro() clears both keys regardless of PAYWALL_LIVE state', () => {
    vi.stubEnv('NEXT_PUBLIC_PAYWALL_LIVE', 'true');
    localStorage.setItem('plainvoice.pro', '1');
    localStorage.setItem('plainvoice.pro.key', 'some-key');
    lockPro();
    expect(localStorage.getItem('plainvoice.pro')).toBeNull();
    expect(localStorage.getItem('plainvoice.pro.key')).toBeNull();
  });

  it('lockPro() also clears entitlement under PAYWALL_LIVE=false', () => {
    vi.stubEnv('NEXT_PUBLIC_PAYWALL_LIVE', 'false');
    localStorage.setItem('plainvoice.pro', '1');
    localStorage.setItem('plainvoice.pro.key', 'some-key');
    lockPro();
    expect(localStorage.getItem('plainvoice.pro')).toBeNull();
    expect(localStorage.getItem('plainvoice.pro.key')).toBeNull();
  });
});
