/**
 * LanguageContext.jsx – React context for multi-language support (EN / Twi / Ga)
 *
 * Wrap your app with <LanguageProvider> and use the useLanguage() hook in any component.
 *
 *   const { lang, setLang, t } = useLanguage();
 *   <p>{t("welcome")}</p>   →  "Welcome" / "Akwaaba" / "Ojekoo"
 */

import React, { createContext, useState, useCallback } from "react";
import translations from "./translations";

const SUPPORTED_LANGS = ["en", "twi", "ga"];
const LANG_KEY = "attendance_app_lang";

function getInitialLang() {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored && SUPPORTED_LANGS.includes(stored)) return stored;
  } catch {
    // no localStorage
  }
  return "en";
}

const LanguageContext = createContext({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
  SUPPORTED_LANGS,
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getInitialLang);

  const setLang = useCallback((newLang) => {
    if (!SUPPORTED_LANGS.includes(newLang)) return;
    setLangState(newLang);
    try {
      localStorage.setItem(LANG_KEY, newLang);
    } catch {
      // silent
    }
  }, []);

  /** Translate a key. Falls back to English, then to the raw key. */
  const t = useCallback(
    (key) => {
      const entry = translations[key];
      if (!entry) return key;
      return entry[lang] || entry.en || key;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, SUPPORTED_LANGS }}>
      {children}
    </LanguageContext.Provider>
  );
}

export default LanguageContext;
