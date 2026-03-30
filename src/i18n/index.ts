import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import fr from './fr.json';

const LANG_KEY = 'parking_language';

export type SupportedLanguage = 'en' | 'fr';

export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

export function getStoredLanguage(): SupportedLanguage {
  const stored = localStorage.getItem(LANG_KEY);
  if (stored === 'en' || stored === 'fr') return stored;
  return 'en';
}

export function storeLanguage(lang: SupportedLanguage): void {
  localStorage.setItem(LANG_KEY, lang);
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    lng: getStoredLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

export default i18n;
