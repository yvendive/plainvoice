const KEY = 'plainvoice.pro';
const KEY_LICENSE = 'plainvoice.pro.key';
const URL_OVERRIDE = 'pro'; // ?pro=1 — keeps dev/QA path active when paywall is not live

/**
 * Whether the production paywall is live.
 *
 * Read inside the function (not captured at module load) so test code can
 * flip `process.env.NEXT_PUBLIC_PAYWALL_LIVE` per case via `vi.stubEnv()`.
 * In Next.js production builds, `process.env.NEXT_PUBLIC_*` is replaced
 * with the literal value at build time regardless of where it appears,
 * so this pattern has no runtime cost in the shipped bundle.
 */
function isPaywallLive(): boolean {
  return process.env.NEXT_PUBLIC_PAYWALL_LIVE === 'true';
}

export function isPro(): boolean {
  if (typeof window === 'undefined') return false;

  // The ?pro=1 URL override is a dev/QA convenience. In production
  // (PAYWALL_LIVE=true) it MUST be a no-op or a paying customer's
  // value-add can be unlocked by anyone appending the param. See #16.
  if (!isPaywallLive()) {
    const params = new URLSearchParams(window.location.search);
    if (params.get(URL_OVERRIDE) === '1') {
      try {
        localStorage.setItem(KEY, '1');
      } catch {
        /* ignore quota / privacy mode */
      }
      return true;
    }
  }

  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function getStoredLicenseKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(KEY_LICENSE);
  } catch {
    return null;
  }
}

export function lockPro(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEY_LICENSE);
  } catch {
    /* ignore */
  }
}
