import { useEffect, useState } from 'react';
import { getLanguage, onLanguageChange } from './i18n';

/** Re-renders the component when the interface language changes. */
export function useLanguage() {
  const [lang, setLang] = useState(getLanguage());
  useEffect(() => onLanguageChange(() => setLang(getLanguage())), []);
  return lang;
}
