'use client';

export type AppLocale = 'en' | 'es' | 'pt';

export const LOCALE_KEY = 'padel_locale';

export function resolveClientLocale(): AppLocale {
  if (typeof window === 'undefined') return 'pt';

  const saved = localStorage.getItem(LOCALE_KEY);
  if (saved === 'en' || saved === 'es' || saved === 'pt') {
    return saved;
  }

  const browser = navigator.language.toLowerCase();
  if (browser.startsWith('pt')) return 'pt';
  if (browser.startsWith('en')) return 'en';
  return 'es';
}

export function persistLocale(locale: AppLocale) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCALE_KEY, locale);
}
