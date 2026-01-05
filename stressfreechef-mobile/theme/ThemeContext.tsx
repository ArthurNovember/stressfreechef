import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeName = "light" | "dark";

const THEME_KEY = "app_theme";

const palettes = {
  dark: {
    background: "#141414ff",
    card: "#222222",
    border: "#1a1a1aff",
    text: "#f4f4f4ff",
    reverseText: "#111111",
    secondaryText: "#e0e0e0ff",
    muted: "#999999",
    pillActive: "#760101",
    danger: "#940000ff",
    shop: "#161515ff",
    list: "#4f1313ff",
    favorite: "#353535ff",
  },
  light: {
    background: "#f5f5f5",
    card: "#ffffff",
    border: "#f2f0f0ff",
    text: "#111111",
    reverseText: "#f4f4f4ff",
    secondaryText: "#222222",
    muted: "#666666",
    pillActive: "#760101",
    danger: "#d32f2f",
    shop: "#ffffff",
    list: "#632929ff",
    favorite: "#7e2828ff",
  },
};

type ThemeContextValue = {
  theme: ThemeName;
  colors: (typeof palettes)["dark"];
  setTheme: (t: ThemeName) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = (await AsyncStorage.getItem(
        THEME_KEY
      )) as ThemeName | null;

      if (stored === "light" || stored === "dark") {
        setThemeState(stored);
      } else {
        const sys = Appearance.getColorScheme();
        const fallback: ThemeName =
          sys === "light" || sys === "dark" ? sys : "dark";
        setThemeState(fallback);
        await AsyncStorage.setItem(THEME_KEY, fallback);
      }

      setReady(true);
    })();
  }, []);

  const setTheme = async (next: ThemeName) => {
    setThemeState(next);
    await AsyncStorage.setItem(THEME_KEY, next);
  };

  if (!ready) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, colors: palettes[theme], setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return ctx;
}
