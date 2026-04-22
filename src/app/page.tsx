'use client';

import { useEffect } from 'react';
import { defaultLocale, isLocale, localeStorageKey } from '@/i18n/config';

export default function RootRedirect() {
  useEffect(() => {
    const stored = window.localStorage.getItem(localeStorageKey);
    if (isLocale(stored)) {
      window.location.replace(`/${stored}/`);
      return;
    }
    const browser = (navigator.language ?? '').toLowerCase();
    const target = browser.startsWith('de') ? 'de' : browser.startsWith('en') ? 'en' : defaultLocale;
    window.location.replace(`/${target}/`);
  }, []);

  return null;
}
