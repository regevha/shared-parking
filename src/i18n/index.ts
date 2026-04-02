import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import fr from './fr.json';
import he from './he.json';

const LANG_KEY = 'parking_language';

export type SupportedLanguage = 'en' | 'fr' | 'he';

export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English',  nativeLabel: 'English'  },
  { code: 'fr', label: 'French',   nativeLabel: 'Français' },
  { code: 'he', label: 'Hebrew',   nativeLabel: 'עברית'    },
];

export function getStoredLanguage(): SupportedLanguage {
  const stored = localStorage.getItem(LANG_KEY);
  if (stored === 'en' || stored === 'fr' || stored === 'he') return stored;
  return 'en';
}

export function storeLanguage(lang: SupportedLanguage): void {
  localStorage.setItem(LANG_KEY, lang);
}

export function isRTL(lang: SupportedLanguage): boolean {
  return lang === 'he';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      he: { translation: he },
    },
    lng: getStoredLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

export default i18n;
