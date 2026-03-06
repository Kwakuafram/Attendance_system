/**
 * LanguageSwitcher.jsx – Small pill-style language toggle (EN / Twi / Ga)
 *
 * Drop this component anywhere. It reads + writes the global language context.
 */

import React from "react";
import { useLanguage } from "./useLanguage";

const LABELS = { en: "EN", twi: "Twi", ga: "Ga" };

export default function LanguageSwitcher() {
  const { lang, setLang, SUPPORTED_LANGS } = useLanguage();

  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
      {SUPPORTED_LANGS.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={[
            "rounded-full px-2.5 py-1 text-[11px] font-bold transition",
            lang === l
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-100",
          ].join(" ")}
        >
          {LABELS[l] || l}
        </button>
      ))}
    </div>
  );
}
