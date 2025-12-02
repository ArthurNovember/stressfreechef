// app/settings.tsx
import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Appearance,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { API_BASE } from "../lib/api";
import { getLocales } from "expo-localization";

const THEME_KEY = "app_theme"; // "light" | "dark"
const LANG_KEY = "app_lang"; // "en" | "cs"
const TOKEN_KEY = "token";

async function getToken() {
  try {
    const t = await AsyncStorage.getItem(TOKEN_KEY);
    return t || "";
  } catch {
    return "";
  }
}

async function clearToken() {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // klidně ignoruj chybu, není kritická
  }
}

export default function SettingsScreen() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [lang, setLang] = useState<"en" | "cs">("en");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const storedTheme = (await AsyncStorage.getItem(THEME_KEY)) as
          | "light"
          | "dark"
          | null;
        const storedLang = (await AsyncStorage.getItem(LANG_KEY)) as
          | "en"
          | "cs"
          | null;

        // 🎨 THEME – nejdřív uložený, jinak systém
        let nextTheme: "light" | "dark" = "dark";

        if (storedTheme === "light" || storedTheme === "dark") {
          nextTheme = storedTheme;
        } else {
          const systemScheme = Appearance.getColorScheme(); // "light" | "dark" | null
          if (systemScheme === "light" || systemScheme === "dark") {
            nextTheme = systemScheme;
          } else {
            nextTheme = "dark"; // fallback
          }
          // poprvé uložíme odvozený theme podle systému
          await AsyncStorage.setItem(THEME_KEY, nextTheme);
        }

        setTheme(nextTheme);

        // 🌍 LANGUAGE – nejdřív uložený, jinak systém
        const locales = getLocales();
        const primary = locales[0];

        const tag = (
          primary?.languageTag ||
          primary?.languageCode ||
          ""
        ).toLowerCase();
        const systemLang: "en" | "cs" = tag.startsWith("cs") ? "cs" : "en";

        let nextLang: "en" | "cs" = systemLang;

        if (storedLang === "en" || storedLang === "cs") {
          nextLang = storedLang;
        } else {
          await AsyncStorage.setItem(LANG_KEY, systemLang);
        }

        setLang(nextLang);

        // 🔐 jestli je user přihlášen
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        setHasToken(!!token);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleThemeChange(next: "light" | "dark") {
    setTheme(next);
    await AsyncStorage.setItem(THEME_KEY, next);
    // TODO: tady pak napojíš reálný theme context / reload appky
  }

  async function handleLangChange(next: "en" | "cs") {
    setLang(next);
    await AsyncStorage.setItem(LANG_KEY, next);
    // TODO: tady pak napojíš i18n / přepnutí textů
  }

  function confirmDeleteProfile() {
    Alert.alert(
      "Delete account",
      "This will permanently delete your account, recipes, shopping list and favorites. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: actuallyDeleteProfile,
        },
      ]
    );
  }

  async function actuallyDeleteProfile() {
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert(
          "Not logged in",
          "You must be logged in to delete account."
        );
        return;
      }

      const res = await fetch(`${API_BASE}/api/account`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok && res.status !== 204) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }

      await clearToken();

      Alert.alert("Account deleted", "Your account has been deleted.");

      // po smazání tě hodíme „domů“ – klidně si cestu uprav
      router.replace("/(tabs)/home");
    } catch (e: any) {
      Alert.alert("Account deletion failed", e?.message || String(e));
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8, color: "#e0e0e0" }}>
          Loading settings…
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#ffffff" />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {/* THEME */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Theme</Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.pill, theme === "dark" && styles.pillActive]}
            onPress={() => handleThemeChange("dark")}
          >
            <Text
              style={[
                styles.pillText,
                theme === "dark" && styles.pillTextActive,
              ]}
            >
              Dark
            </Text>
          </Pressable>
          <Pressable
            style={[styles.pill, theme === "light" && styles.pillActive]}
            onPress={() => handleThemeChange("light")}
          >
            <Text
              style={[
                styles.pillText,
                theme === "light" && styles.pillTextActive,
              ]}
            >
              Light
            </Text>
          </Pressable>
        </View>
        <Text style={styles.helper}>
          (zatím jen ukládá volbu do AsyncStorage – později napojíme na reálný
          theme)
        </Text>
      </View>

      {/* LANGUAGE */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Language</Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.pill, lang === "en" && styles.pillActive]}
            onPress={() => handleLangChange("en")}
          >
            <Text
              style={[styles.pillText, lang === "en" && styles.pillTextActive]}
            >
              English
            </Text>
          </Pressable>
          <Pressable
            style={[styles.pill, lang === "cs" && styles.pillActive]}
            onPress={() => handleLangChange("cs")}
          >
            <Text
              style={[styles.pillText, lang === "cs" && styles.pillTextActive]}
            >
              Čeština
            </Text>
          </Pressable>
        </View>
        <Text style={styles.helper}>
          (stejně jako theme – preference je uložená, později na ni navážeme
          texty)
        </Text>
      </View>

      {/* DELETE PROFILE */}
      {hasToken && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger zone</Text>

          <Pressable
            style={styles.deleteBtn}
            onPress={confirmDeleteProfile}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator />
            ) : (
              <>
                <MaterialIcons name="delete-forever" size={20} color="#fff" />
                <Text style={styles.deleteBtnText}>Delete account</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.helper}>
            This will permanently delete your account.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#141414ff",
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  center: {
    flex: 1,
    backgroundColor: "#141414ff",
    justifyContent: "center",
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f4f4f4ff",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e0e0e0ff",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#444",
    backgroundColor: "#222",
  },
  pillActive: {
    backgroundColor: "#760101",
    borderColor: "#760101",
  },
  pillText: {
    color: "#cccccc",
    fontWeight: "600",
  },
  pillTextActive: {
    color: "#ffffff",
  },
  helper: {
    marginTop: 6,
    fontSize: 12,
    color: "#999999",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#940000ff",
  },
  deleteBtnText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
