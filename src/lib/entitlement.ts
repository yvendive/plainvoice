const KEY = 'plainvoice.pro';
const KEY_LICENSE = 'plainvoice.pro.key';
const URL_OVERRIDE = 'pro'; // ?pro=1 — keeps dev/QA path

export function isPro(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get(URL_OVERRIDE) === '1') {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore quota / privacy mode */
    }
    return true;
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
