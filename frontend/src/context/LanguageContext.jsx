import { createContext, useMemo, useState, useEffect } from 'react';
import { translations } from '../translations';

export const LanguageContext = createContext({
  language: 'en',
  toggleLanguage: () => {},
  strings: translations.en,
});

export const LanguageProvider = ({ children }) => {
  const getInitialLanguage = () => {
    const nav = typeof navigator !== 'undefined' && navigator.language ? navigator.language.toLowerCase() : '';
    if (nav.startsWith('am')) return 'am';
    return 'en';
  };

  const [language, setLanguage] = useState(getInitialLanguage);

  const toggleLanguage = () => {
    setLanguage((current) => (current === 'en' ? 'am' : 'en'));
  };

  const value = useMemo(
    () => ({ language, toggleLanguage, strings: translations[language] || translations.en }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
