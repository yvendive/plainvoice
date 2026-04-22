'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { isLocale, locales, localeStorageKey, type Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

function swapLocaleInPath(pathname: string, nextLocale: Locale): string {
  const segments = pathname.split('/');
  if (segments.length > 1 && isLocale(segments[1])) {
    segments[1] = nextLocale;
    return segments.join('/') || `/${nextLocale}`;
  }
  return `/${nextLocale}${pathname === '/' ? '' : pathname}`;
}

export function LanguageToggle() {
  const current = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleSwitch = useCallback(
    (next: Locale) => {
      if (next === current) return;
      try {
        window.localStorage.setItem(localeStorageKey, next);
      } catch {
        // localStorage unavailable — ignore, navigation still works.
      }
      const target = swapLocaleInPath(pathname ?? '/', next);
      startTransition(() => {
        router.push(target);
        router.refresh();
      });
    },
    [current, pathname, router],
  );

  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center rounded-md border border-[color:var(--border)] p-0.5 text-xs"
    >
      {locales.map((loc) => {
        const active = loc === current;
        return (
          <button
            key={loc}
            type="button"
            onClick={() => handleSwitch(loc)}
            disabled={isPending}
            aria-pressed={active}
            className={cn(
              'rounded px-2 py-1 font-medium uppercase tracking-wide transition-colors',
              active
                ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
                : 'text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]',
            )}
          >
            {loc}
          </button>
        );
      })}
    </div>
  );
}
