const KEY = 'plainvoice_pro';

export function isPro(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('pro') === '1') {
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

export function lockPro(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
