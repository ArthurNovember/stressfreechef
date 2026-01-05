import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { getLocales } from "expo-localization";

import { API_BASE } from "../lib/api";
import { t, Lang, LANG_KEY } from "../i18n/strings";
import { useTheme } from "../theme/ThemeContext";

/* =========================
   CONSTS + STORAGE
========================= */
const TOKEN_KEY = "token";
const VOICE_ENABLED_KEY = "settings:voiceEnabled";
const OLD_BLOW_NEXT_KEY = "settings:blowNextEnabled";

async function getToken() {
  try {
    return (await AsyncStorage.getItem(TOKEN_KEY)) || "";
  } catch {
    return "";
  }
}

async function clearToken() {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {}
}

async function loadStoredLang(): Promise<"en" | "cs" | null> {
  try {
    const stored = await AsyncStorage.getItem(LANG_KEY);
    return stored === "en" || stored === "cs" ? stored : null;
  } catch {
    return null;
  }
}

function getSystemLang(): "en" | "cs" {
  const primary = getLocales()?.[0];
  const tag = (
    primary?.languageTag ||
    primary?.languageCode ||
    ""
  ).toLowerCase();
  return tag.startsWith("cs") ? "cs" : "en";
}

async function loadVoiceEnabled(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(VOICE_ENABLED_KEY);
    if (stored === "1" || stored === "0") return stored === "1";
    // ⤵️ migrace ze starého klíče (jen pokud nový ještě neexistuje)
    const old = await AsyncStorage.getItem(OLD_BLOW_NEXT_KEY);
    const migrated = old === "1";
    await AsyncStorage.setItem(VOICE_ENABLED_KEY, migrated ? "1" : "0");
    return migrated;
  } catch {
    return false;
  }
}

/* =========================
   HELPERS 
========================= */
function pickCancelText(lang: Lang) {
  return lang === "cs" ? "Zrušit" : "Cancel";
}

function pickDeleteText(lang: Lang) {
  return lang === "cs" ? "Smazat" : "Delete";
}

/* =========================
   SCREEN
========================= */
export default function SettingsScreen() {
  const { theme, setTheme, colors } = useTheme();

  const [lang, setLang] = useState<Lang>("en");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  /* =========================
     EFFECTS
  ========================= */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const storedLang = await loadStoredLang();
        const systemLang = getSystemLang();

        const nextLang: "en" | "cs" = storedLang ?? systemLang;

        if (!storedLang) {
          await AsyncStorage.setItem(LANG_KEY, systemLang);
        }

        const token = await AsyncStorage.getItem(TOKEN_KEY);
        const voice = await loadVoiceEnabled();

        if (cancelled) return;

        setLang(nextLang);
        setHasToken(!!token);
        setVoiceEnabled(voice);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =========================
     HELPERS
  ========================= */
  const handleThemeChange = useCallback(
    async (next: "light" | "dark") => {
      await setTheme(next);
    },
    [setTheme]
  );

  const handleLangChange = useCallback(async (next: "en" | "cs") => {
    setLang(next);
    await AsyncStorage.setItem(LANG_KEY, next);
  }, []);

  const toggleVoiceEnabled = useCallback(() => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      AsyncStorage.setItem(VOICE_ENABLED_KEY, next ? "1" : "0").catch(() => {});
      return next;
    });
  }, []);

  const actuallyDeleteProfile = useCallback(async () => {
    try {
      setDeleting(true);

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
      setHasToken(false);

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
    } finally {
      setDeleting(false);
    }
  }, [lang]);

  const confirmDeleteProfile = useCallback(() => {
    Alert.alert(
      t(lang, "settings", "confirmDeleteTitle"),
      t(lang, "settings", "confirmDeleteMessage"),
      [
        { text: pickCancelText(lang), style: "cancel" },
        {
          text: pickDeleteText(lang),
          style: "destructive",
          onPress: actuallyDeleteProfile,
        },
      ]
    );
  }, [lang, actuallyDeleteProfile]);

  /* =========================
     LOADING
  ========================= */
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8, color: colors.text }}>
          {t(lang, "settings", "loading")}
        </Text>
      </View>
    );
  }

  /* =========================
     UI
  ========================= */
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t(lang, "settings", "headerTitle")}
        </Text>
      </View>

      <View style={styles.section}>
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.secondaryText ?? colors.text },
          ]}
        >
          {t(lang, "settings", "themeTitle")}
        </Text>

        <View style={styles.row}>
          <Pressable
            style={[
              styles.pill,
              { backgroundColor: colors.card, borderColor: colors.border },
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

          <Pressable
            style={[
              styles.pill,
              { backgroundColor: colors.card, borderColor: colors.border },
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

      <View style={styles.section}>
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.secondaryText ?? colors.text },
          ]}
        >
          {t(lang, "settings", "langTitle")}
        </Text>

        <View style={styles.row}>
          <Pressable
            style={[
              styles.pill,
              { backgroundColor: colors.card, borderColor: colors.border },
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
              { backgroundColor: colors.card, borderColor: colors.border },
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
            onPress={toggleVoiceEnabled}
            style={[
              styles.pill,
              { backgroundColor: colors.card, borderColor: colors.border },
              voiceEnabled && {
                backgroundColor: colors.pillActive,
                borderColor: colors.pillActive,
              },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                { color: colors.text },
                voiceEnabled && styles.pillTextActive,
              ]}
            >
              {t(lang, "settings", "handsfreeNext")}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.helper, { color: colors.muted }]}>
          {t(lang, "settings", "blowWarning")}
        </Text>
      </View>

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
            style={[
              styles.deleteBtn,
              { backgroundColor: "#962626ff", opacity: deleting ? 0.7 : 1 },
            ]}
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

          <Text style={[styles.helper, { color: colors.muted }]}>
            {t(lang, "settings", "dangerHelper")}
          </Text>
        </View>
      )}
    </View>
  );
}

/* =========================
   STYLES
========================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  center: {
    flex: 1,
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
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
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
  },
  pillText: {
    fontWeight: "600",
  },
  pillTextActive: {
    color: "#ffffff",
  },
  helper: {
    marginTop: 6,
    fontSize: 12,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  deleteBtnText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
