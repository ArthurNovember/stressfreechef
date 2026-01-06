import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { Lang, LANG_KEY } from "./strings";


type LangContextValue = {
  lang: Lang;
  setLang: (l: Lang) => Promise<void>;
  ready: boolean;
};

const LangContext = createContext<LangContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(LANG_KEY);
      if (stored === "cs" || stored === "en") {
        setLangState(stored);
      } else {
        const sys = getLocales()[0]?.languageCode === "cs" ? "cs" : "en";
        setLangState(sys);
        await AsyncStorage.setItem(LANG_KEY, sys);
      }
      setReady(true);
    })();
  }, []);

  const setLang = async (next: Lang) => {
    setLangState(next);
    await AsyncStorage.setItem(LANG_KEY, next);
  };

  return (
    <LangContext.Provider value={{ lang, setLang, ready }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
}
