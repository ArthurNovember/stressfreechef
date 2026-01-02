// app/settings.tsx
import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { API_BASE } from "../lib/api";
import { getLocales } from "expo-localization";
import { t, Lang, LANG_KEY } from "../i18n/strings";
import { useTheme } from "../theme/ThemeContext"; // ← napojení na ThemeProvider

const TOKEN_KEY = "token";
const BLOW_NEXT_KEY = "settings:blowNextEnabled";

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
  const { theme, setTheme, colors } = useTheme(); // ← globální theme
  const [lang, setLang] = useState<Lang>("en");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [blowNext, setBlowNext] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const storedLang = (await AsyncStorage.getItem(LANG_KEY)) as
          | "en"
          | "cs"
          | null;

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

        // 💨 BLOW-NEXT – načtení
        const storedBlow = await AsyncStorage.getItem(BLOW_NEXT_KEY);
        setBlowNext(storedBlow === "1");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 🎨 přepnutí tématu přes ThemeContext
  async function handleThemeChange(next: "light" | "dark") {
    await setTheme(next); // ThemeProvider se postará o AsyncStorage + repaint
  }

  async function handleLangChange(next: "en" | "cs") {
    setLang(next);
    await AsyncStorage.setItem(LANG_KEY, next);
  }

  async function toggleBlowNext() {
    const next = !blowNext;
    setBlowNext(next);
    await AsyncStorage.setItem(BLOW_NEXT_KEY, next ? "1" : "0");
  }

  function confirmDeleteProfile() {
    Alert.alert(
      t(lang, "settings", "confirmDeleteTitle"),
      t(lang, "settings", "confirmDeleteMessage"),
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
          t(lang, "settings", "notLoggedInTitle"),
          t(lang, "settings", "notLoggedInMsg")
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

      Alert.alert(
        t(lang, "settings", "deletedTitle"),
        t(lang, "settings", "deletedMsg")
      );

      router.replace("/(tabs)/home");
    } catch (e: any) {
      Alert.alert(
        t(lang, "settings", "deleteFailedTitle"),
        e?.message || String(e)
      );
    }
  }

  if (loading) {
    return (
      <View
        style={[
          styles.center,
          {
            backgroundColor: colors.background,
          },
        ]}
      >
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8, color: colors.text }}>
          {t(lang, "settings", "loading")}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      {/* HEADER */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text
          style={[
            styles.headerTitle,
            {
              color: colors.text,
            },
          ]}
        >
          {t(lang, "settings", "headerTitle")}
        </Text>
      </View>

      {/* THEME */}
      <View style={styles.section}>
        <Text
          style={[
            styles.sectionTitle,
            {
              color: colors.secondaryText ?? colors.text,
            },
          ]}
        >
          {t(lang, "settings", "themeTitle")}
        </Text>
        <View style={styles.row}>
          {/* DARK */}
          <Pressable
            style={[
              styles.pill,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
              theme === "dark" && {
                backgroundColor: colors.pillActive,
                borderColor: colors.pillActive,
              },
            ]}
            onPress={() => handleThemeChange("dark")}
          >
            <Text
              style={[
                styles.pillText,
                { color: colors.text },
                theme === "dark" && styles.pillTextActive,
              ]}
            >
              {t(lang, "settings", "themeDark")}
            </Text>
          </Pressable>

          {/* LIGHT */}
          <Pressable
            style={[
              styles.pill,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
              theme === "light" && {
                backgroundColor: colors.pillActive,
                borderColor: colors.pillActive,
              },
            ]}
            onPress={() => handleThemeChange("light")}
          >
            <Text
              style={[
                styles.pillText,
                { color: colors.text },
                theme === "light" && styles.pillTextActive,
              ]}
            >
              {t(lang, "settings", "themeLight")}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* LANGUAGE */}
      <View style={styles.section}>
        <Text
          style={[
            styles.sectionTitle,
            {
              color: colors.secondaryText ?? colors.text,
            },
          ]}
        >
          {t(lang, "settings", "langTitle")}
        </Text>
        <View style={styles.row}>
          <Pressable
            style={[
              styles.pill,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
              lang === "en" && {
                backgroundColor: colors.pillActive,
                borderColor: colors.pillActive,
              },
            ]}
            onPress={() => handleLangChange("en")}
          >
            <Text
              style={[
                styles.pillText,
                { color: colors.text },
                lang === "en" && styles.pillTextActive,
              ]}
            >
              English
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.pill,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
              lang === "cs" && {
                backgroundColor: colors.pillActive,
                borderColor: colors.pillActive,
              },
            ]}
            onPress={() => handleLangChange("cs")}
          >
            <Text
              style={[
                styles.pillText,
                { color: colors.text },
                lang === "cs" && styles.pillTextActive,
              ]}
            >
              Čeština
            </Text>
          </Pressable>
        </View>
      </View>

      {/* HANDS-FREE COOKING */}
      <View style={styles.section}>
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.secondaryText ?? colors.text },
          ]}
        >
          {t(lang, "settings", "handsfreeTitle")}
        </Text>
        <View style={styles.row}>
          <Pressable
            onPress={toggleBlowNext}
            style={[
              styles.pill,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
              blowNext && {
                backgroundColor: colors.pillActive,
                borderColor: colors.pillActive,
              },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                { color: colors.text },
                blowNext && styles.pillTextActive,
              ]}
            >
              {t(lang, "settings", "handsfreeNext")}
            </Text>
          </Pressable>
        </View>
        <Text
          style={[
            styles.helper,
            {
              color: colors.muted,
            },
          ]}
        >
          {t(lang, "settings", "blowWarning")}
        </Text>
      </View>

      {/* DELETE PROFILE */}
      {hasToken && (
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.secondaryText ?? colors.text },
            ]}
          >
            {t(lang, "settings", "dangerTitle")}
          </Text>

          <Pressable
            style={[styles.deleteBtn, { backgroundColor: "#962626ff" }]}
            onPress={confirmDeleteProfile}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator />
            ) : (
              <>
                <MaterialIcons name="delete-forever" size={20} color="#fff" />
                <Text style={styles.deleteBtnText}>
                  {t(lang, "settings", "deleteBtn")}
                </Text>
              </>
            )}
          </Pressable>

          <Text
            style={[
              styles.helper,
              {
                color: colors.muted,
              },
            ]}
          >
            {t(lang, "settings", "dangerHelper")}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // konkrétní barvu přepíšeme z ThemeContextu
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
    color: "#f4f4f4ff", // přepsáno inline podle theme
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e0e0e0ff", // přepsáno inline
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
