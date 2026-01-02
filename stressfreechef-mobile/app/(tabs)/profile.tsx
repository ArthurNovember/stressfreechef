import { t, Lang, LANG_KEY } from "../../i18n/strings";
import Constants from "expo-constants";
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  ScrollView,
  Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE, fetchJSON } from "../../lib/api";
import { useTheme } from "../../theme/ThemeContext";

const BASE = API_BASE || "https://stressfreecheff-backend.onrender.com";

import { router } from "expo-router";
import { Video, ResizeMode } from "expo-av";

import { MaterialIcons } from "@expo/vector-icons";

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>["name"];

function StarRatingDisplay({
  value,
  size = 16,
  count,
  color,
}: {
  value: number;
  size?: number;
  count?: number;
  color?: string;
}) {
  const val = Math.max(0, Math.min(5, value || 0));

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ flexDirection: "row" }}>
        {Array.from({ length: 5 }, (_, i) => {
          const diff = val - i;

          let icon: MaterialIconName = "star-border";

          if (diff >= 0.75) icon = "star";
          else if (diff >= 0.25) icon = "star-half";

          return (
            <MaterialIcons
              key={i}
              name={icon}
              size={size}
              color="#ffd54f"
              style={{ marginRight: 1 }}
            />
          );
        })}
      </View>

      {typeof count === "number" ? (
        <Text
          style={{ color: color || "#dcd7d7ff", fontSize: 12, opacity: 0.8 }}
        >
          {val.toFixed(1)} ({count})
        </Text>
      ) : null}
    </View>
  );
}

/** ===== Helpers ===== */
const TOKEN_KEY = "token";
async function getToken() {
  return (await AsyncStorage.getItem(TOKEN_KEY)) || "";
}
async function setToken(t: string) {
  await AsyncStorage.setItem(TOKEN_KEY, t);
}
async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

function isVideo(url = "") {
  return /(\.mp4|\.webm|\.mov|\.m4v)(\?|#|$)/i.test(url);
}

function getCover(r: any) {
  const url =
    r?.image?.url ||
    r?.imgSrc ||
    (r?.steps || []).find((s: any) => s?.type === "image" && s?.src)?.src ||
    (r?.steps || []).find((s: any) => s?.src)?.src ||
    "https://i.imgur.com/CZaFjz2.png"; // placeholder
  return { url, isVideo: isVideo(url) };
}

function translateDifficulty(lang: Lang, diff: string) {
  if (lang === "cs") {
    if (diff === "Beginner") return "Začátečník";
    if (diff === "Intermediate") return "Pokročilý";
    if (diff === "Hard") return "Expert";
  }
  return diff;
}

async function addIngredientToShopping(ingredient: string, lang: Lang) {
  const trimmed = ingredient.trim();
  if (!trimmed) return;

  try {
    const token = await getToken();
    if (!token) {
      Alert.alert(
        t(lang, "home", "loginRequiredTitle"),
        t(lang, "home", "loginRequiredMsg")
      );
      return;
    }

    const res = await fetch(`${API_BASE}/api/shopping-list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: trimmed,
        shop: [],
      }),
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // prázdná response = nevadí
    }

    if (!res.ok) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    Alert.alert(
      t(lang, "profile", "addedTitle"),
      lang === "cs"
        ? `"${trimmed}" bylo přidáno do nákupního seznamu.`
        : `"${trimmed}" was added to your shopping list.`
    );
  } catch (e: any) {
    Alert.alert("Failed to add", e?.message || String(e));
  }
}

// Pomůcka na rozpoznání „neautorizován“
const isUnauthorizedError = (e: any) => {
  const msg = String(e?.message ?? e ?? "");
  // naše fetchJSON hází "HTTP 401: ..." – zároveň pokryjeme text tokenu
  return (
    /\\b401\\b/i.test(msg) ||
    /unauthor/i.test(msg) ||
    (/token/i.test(msg) && /invalid|expire|platn/i.test(msg))
  );
};

/** ===== AuthForm (RN) ===== */
function AuthFormRN({
  onLoggedIn,
  lang,
}: {
  onLoggedIn: () => void;
  lang: Lang;
}) {
  const { colors } = useTheme(); // 💡 TADY
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSignup() {
    if (password !== confirm) {
      Alert.alert(t(lang, "profile", "passwordsDontMatch"));
      return;
    }
    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(String(data?.error || "Registration error."));
      Alert.alert(
        t(lang, "profile", "registrationSuccessfulTitle"),
        t(lang, "profile", "registrationSuccessfulMsg")
      );
      setMode("login");
    } catch (e: any) {
      Alert.alert(
        t(lang, "profile", "registrationFailedTitle"),
        e?.message || String(e)
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin() {
    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data?.token)
        throw new Error(String(data?.error || "Login error."));
      await setToken(String(data.token));
      Alert.alert(t(lang, "profile", "loginSuccessfulTitle"));

      onLoggedIn();
    } catch (e: any) {
      Alert.alert(
        t(lang, "profile", "loginFailedTitle"),
        e?.message || String(e)
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.authWrap,
        { backgroundColor: colors.background },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.authSwitchRow}>
        <Pressable
          onPress={() => setMode("signup")}
          style={[
            styles.switchBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            mode === "signup" && {
              backgroundColor: colors.pillActive,
              borderColor: colors.pillActive,
            },
          ]}
        >
          <Text style={[styles.switchText, { color: colors.text }]}>
            {t(lang, "profile", "authSignUp")}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.switchBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            mode === "login" && {
              backgroundColor: colors.pillActive,
              borderColor: colors.pillActive,
            },
          ]}
          onPress={() => setMode("login")}
        >
          <Text style={[styles.switchText, { color: colors.text }]}>
            {t(lang, "profile", "authLogin")}
          </Text>
        </Pressable>
      </View>

      {mode === "signup" && (
        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.text }]}>
            {t(lang, "profile", "username")}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <Text style={[styles.label, { color: colors.text }]}>Email</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Text style={[styles.label, { color: colors.text }]}>
            {" "}
            {t(lang, "profile", "password")}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Text style={[styles.label, { color: colors.text }]}>
            {t(lang, "profile", "confirmPassword")}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
          />
          <Pressable
            disabled={busy}
            onPress={handleSignup}
            style={[
              styles.primaryBtn,
              { backgroundColor: colors.pillActive },
              busy && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.primaryBtnText, { color: "white" }]}>
              {busy
                ? t(lang, "profile", "pleaseWait")
                : t(lang, "profile", "authSignUp")}
            </Text>
          </Pressable>
        </View>
      )}

      {mode === "login" && (
        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.text }]}>Email</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Text style={[styles.label, { color: colors.text }]}>
            {" "}
            {t(lang, "profile", "password")}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Pressable
            disabled={busy}
            onPress={handleLogin}
            style={[
              styles.primaryBtn,
              { backgroundColor: colors.pillActive },
              busy && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.primaryBtnText, { color: "white" }]}>
              {busy
                ? t(lang, "profile", "pleaseWait")
                : t(lang, "profile", "authLogin")}
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

/** ===== MyProfile (RN) ===== */
function MyProfileRN({
  onLoggedOut,
  lang,
}: {
  onLoggedOut: () => void;
  lang: Lang;
}) {
  const { colors } = useTheme(); // 💡
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const SAVED_LIMIT = 8;

  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [savedPage, setSavedPage] = useState(1);
  const [savedPages, setSavedPages] = useState(1);
  const [savedLoadingMore, setSavedLoadingMore] = useState(false);

  const MY_LIMIT = 12;

  const [myPage, setMyPage] = useState(1);
  const [myPages, setMyPages] = useState(1);
  const [myLoadingMore, setMyLoadingMore] = useState(false);

  const loadMyPage = useCallback(async (pageToLoad: number) => {
    const token = await getToken();
    if (!token) throw new Error("Missing token");

    const res = await fetchJSON<{
      items?: any[];
      page?: number;
      pages?: number;
    }>(`${API_BASE}/api/my-recipes?page=${pageToLoad}&limit=${MY_LIMIT}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const next = Array.isArray(res?.items) ? res.items : [];
    setMyPages(Number(res?.pages) || 1);

    setItems((prev) => (pageToLoad === 1 ? next : [...prev, ...next]));
  }, []);

  const loadMoreMy = useCallback(async () => {
    if (myLoadingMore) return;
    if (myPage >= myPages) return;

    try {
      setMyLoadingMore(true);
      const nextPage = myPage + 1;
      await loadMyPage(nextPage);
      setMyPage(nextPage);
    } catch (e: any) {
      // klidně jen log/alert
      console.log("Load more my failed:", e?.message || String(e));
    } finally {
      setMyLoadingMore(false);
    }
  }, [myLoadingMore, myPage, myPages, loadMyPage]);

  const loadSavedPage = useCallback(async (pageToLoad: number) => {
    const token = await getToken();
    if (!token) throw new Error("Missing token");

    const res = await fetchJSON<{
      items?: any[];
      pages?: number;
    }>(
      `${API_BASE}/api/saved-community-recipes?page=${pageToLoad}&limit=${SAVED_LIMIT}&sort=newest`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const next = Array.isArray(res?.items) ? res.items : [];
    setSavedPages(Number(res?.pages) || 1);

    setSavedItems((prev) => (pageToLoad === 1 ? next : [...prev, ...next]));
  }, []);

  const loadMoreSaved = useCallback(async () => {
    if (savedLoadingMore) return;
    if (savedPage >= savedPages) return;

    try {
      setSavedLoadingMore(true);
      const nextPage = savedPage + 1;
      await loadSavedPage(nextPage);
      setSavedPage(nextPage);
    } finally {
      setSavedLoadingMore(false);
    }
  }, [savedLoadingMore, savedPage, savedPages, loadSavedPage]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing token");

      try {
        const me = await fetchJSON(`${API_BASE}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(me || null);
      } catch {
        setUser(null);
      }

      setMyPage(1);
      setMyPages(1);
      setItems([]);
      await loadMyPage(1);
      setSavedPage(1);
      setSavedPages(1);
      setSavedItems([]);
      await loadSavedPage(1);
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        await clearToken();
        onLoggedOut();
        return;
      }
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [onLoggedOut]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const handleLogout = useCallback(async () => {
    await clearToken();
    onLoggedOut();
  }, [onLoggedOut]);

  const handleDeleteRecipe = useCallback(async (id: string) => {
    Alert.alert(
      t(lang, "profile", "deleteRecipeTitle"),
      t(lang, "profile", "deleteRecipeMsg"),
      [
        { text: t(lang, "profile", "cancel"), style: "cancel" },
        {
          text: t(lang, "profile", "delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getToken();
              const res = await fetch(`${API_BASE}/api/my-recipes/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok) {
                const txt = await res.text();
                throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
              }
              setItems((prev) => prev.filter((r) => r?._id !== id));
            } catch (e: any) {
              Alert.alert("Deletion failed", e?.message || String(e));
            }
          },
        },
      ]
    );
  }, []);

  const handleRemoveSaved = useCallback(async (id: string) => {
    Alert.alert(t(lang, "profile", "removeSavedTitle"), "", [
      { text: t(lang, "profile", "cancel"), style: "cancel" },
      {
        text: t(lang, "profile", "remove"),
        style: "destructive",
        onPress: async () => {
          try {
            const token = await getToken();
            const res = await fetch(
              `${API_BASE}/api/saved-community-recipes/${id}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            if (!res.ok && res.status !== 204) {
              const txt = await res.text();
              throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
            }
            setSavedItems((prev) =>
              prev.filter((r: any) => String(r?._id || r?.id) !== id)
            );
          } catch (e: any) {
            Alert.alert(
              t(lang, "profile", "removeFailedTitle"),
              e?.message || String(e)
            );
          }
        },
      },
    ]);
  }, []);

  const selectedCover = selected ? getCover(selected) : null;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8, color: colors.text }}>
          {t(lang, "profile", "loading")}
        </Text>
      </View>
    );
  }

  if (err) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.err, { color: colors.danger }]}>
          {t(lang, "profile", "errorPrefix")}: {err}
        </Text>
        <Pressable
          onPress={loadAll}
          style={[
            styles.primaryBtn,
            { marginTop: 12, backgroundColor: colors.pillActive },
          ]}
        >
          <Text style={[styles.primaryBtnText, { color: colors.text }]}>
            {t(lang, "profile", "retry")}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: 15,
      }}
    >
      <View style={styles.profileHeader}>
        <View style={{ flex: 1 }}></View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={handleLogout}
            style={[
              styles.secondaryBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
              {t(lang, "profile", "logout")}
            </Text>
          </Pressable>
        </View>
      </View>
      <View>
        {/* SAVED RECIPES */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t(lang, "profile", "savedRecipesTitle")}
        </Text>
        {savedItems.length === 0 ? (
          <Text
            style={{
              opacity: 0.7,
              paddingHorizontal: 16,
              color: colors.muted,
            }}
          >
            {t(lang, "profile", "savedEmpty")}
          </Text>
        ) : null}
        <FlatList
          data={savedItems}
          onEndReached={loadMoreSaved}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            savedLoadingMore ? (
              <ActivityIndicator style={{ marginHorizontal: 12 }} />
            ) : null
          }
          horizontal
          keyExtractor={(r, idx) => String(r?._id || (r as any)?.id || idx)}
          contentContainerStyle={{ padding: 12, gap: 12 }}
          renderItem={({ item }) => {
            const cover = getCover(item); // sjednocený zdroj
            const rid = String(item?._id || (item as any)?.id || "");
            return (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Pressable
                  style={{ flex: 1, flexDirection: "row" }}
                  onPress={() => setSelected(item)}
                >
                  {cover.isVideo ? (
                    <Video
                      source={{ uri: cover.url }}
                      style={styles.cardImg}
                      resizeMode={ResizeMode.COVER}
                      isMuted
                      isLooping
                      shouldPlay
                    />
                  ) : (
                    <Image source={{ uri: cover.url }} style={styles.cardImg} />
                  )}

                  <View style={{ flex: 1, paddingHorizontal: 10 }}>
                    <Text
                      style={[styles.cardTitle, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {item?.title || "Untitled"}
                    </Text>
                    <Text
                      style={[styles.metaText, { color: colors.secondaryText }]}
                    >
                      {t(lang, "home", "difficulty")}:{" "}
                      {translateDifficulty(lang, item?.difficulty || "—")}
                    </Text>
                    <Text
                      style={[styles.metaText, { color: colors.secondaryText }]}
                    >
                      {t(lang, "home", "time")}: {item?.time || "—"} ⏱️
                    </Text>
                    <StarRatingDisplay
                      value={item?.ratingAvg ?? item?.rating ?? 0}
                      count={item?.ratingCount}
                      color={colors.secondaryText}
                    />
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => handleRemoveSaved(rid)}
                  style={styles.deleteBtn}
                >
                  <MaterialIcons name="close" size={18} color={colors.text} />
                </Pressable>
              </View>
            );
          }}
        />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t(lang, "profile", "myRecipesTitle")}
        </Text>
        {items.length === 0 ? (
          <Text style={{ opacity: 0.7, paddingHorizontal: 16, color: "white" }}>
            {t(lang, "profile", "myEmpty")}
          </Text>
        ) : null}
        <FlatList
          data={items}
          keyExtractor={(r) => String(r?._id || r?.id)}
          contentContainerStyle={{ padding: 12, gap: 12 }}
          onEndReached={loadMoreMy}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            myLoadingMore ? (
              <ActivityIndicator style={{ marginVertical: 12 }} />
            ) : null
          }
          renderItem={({ item }) => {
            const cover = getCover(item);
            const rid = String(item?._id || item?.id || "");
            return (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Pressable
                  style={{ flex: 1, flexDirection: "row" }}
                  onPress={() => setSelected(item)}
                >
                  {cover.isVideo ? (
                    <Video
                      source={{ uri: cover.url }}
                      style={styles.cardImg}
                      resizeMode={ResizeMode.COVER}
                      isMuted
                      isLooping
                      shouldPlay
                    />
                  ) : (
                    <Image source={{ uri: cover.url }} style={styles.cardImg} />
                  )}
                  <View style={{ flex: 1, paddingHorizontal: 10 }}>
                    <Text
                      style={[styles.cardTitle, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {item?.title || "Untitled"}
                    </Text>
                    <Text
                      style={[styles.metaText, { color: colors.secondaryText }]}
                    >
                      {t(lang, "home", "difficulty")}:{" "}
                      {translateDifficulty(lang, item?.difficulty || "—")}
                    </Text>
                    <Text
                      style={[styles.metaText, { color: colors.secondaryText }]}
                    >
                      {t(lang, "home", "time")}: {item?.time || "—"} ⏱️
                    </Text>
                    <StarRatingDisplay
                      value={item?.ratingAvg ?? item?.rating ?? 0}
                      count={item?.ratingCount}
                      color={colors.secondaryText}
                    />
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => handleDeleteRecipe(String(item?._id))}
                  style={styles.deleteBtn}
                >
                  <MaterialIcons name="close" size={18} color={colors.text} />
                </Pressable>
              </View>
            );
          }}
        />
      </View>
      {/* Modal s náhledem receptu */}
      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
              {selectedCover && selectedCover.isVideo ? (
                <Video
                  source={{ uri: selectedCover.url }}
                  style={styles.modalImg}
                  resizeMode={ResizeMode.CONTAIN}
                  useNativeControls
                  shouldPlay
                />
              ) : (
                <Image
                  source={{ uri: selectedCover?.url || selected?.imgSrc }}
                  style={styles.modalImg}
                />
              )}

              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {selected?.title}
              </Text>
              {typeof selected?.ratingAvg === "number" && (
                <StarRatingDisplay
                  value={selected.ratingAvg}
                  count={selected.ratingCount}
                  size={20}
                  color={colors.secondaryText}
                />
              )}

              {selected?.ingredients?.length ? (
                <>
                  <Text style={[styles.section, { color: colors.pillActive }]}>
                    {t(lang, "profile", "ingredients")}
                  </Text>
                  {selected!.ingredients!.map((ing: string, i: number) => (
                    <View
                      key={i}
                      style={[
                        styles.ingredientRow,
                        { borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.ingredient, { color: colors.text }]}>
                        • {ing}
                      </Text>

                      <Pressable
                        style={[
                          styles.ingredientAddBtn,
                          { backgroundColor: colors.pillActive },
                        ]}
                        onPress={() => addIngredientToShopping(ing, lang)}
                      >
                        <MaterialIcons
                          name="add-shopping-cart"
                          size={18}
                          color="#ffffff"
                        />
                      </Pressable>
                    </View>
                  ))}
                </>
              ) : null}

              <Pressable
                style={[
                  styles.primaryBtn,
                  { backgroundColor: colors.pillActive },
                ]}
                onPress={() => {
                  // přejít na detail se „steps“
                  const rid = String(selected?._id || selected?.id || "");
                  router.push({
                    pathname: "/recipe/[id]",
                    params: {
                      id: rid,
                      // POZN: dočasně předáme i celý recipe (kvůli rychlosti),
                      // později uděláme fetch na detail podle id:
                      recipe: JSON.stringify(selected),
                      source: "profile",
                    },
                  });
                  setSelected(null);
                }}
              >
                <Text style={[styles.primaryBtnText, { color: "white" }]}>
                  {t(lang, "profile", "getStarted")}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.secondaryBtn,
                  {
                    backgroundColor: colors.border,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setSelected(null)}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
                  {t(lang, "profile", "close")}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** ===== Profile root ===== */
export default function ProfileScreen() {
  const { colors } = useTheme();
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [lang, setLang] = useState<Lang>("en");
  const refreshAuth = useCallback(async () => {
    const t = await getToken();
    setHasToken(Boolean(t));
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(LANG_KEY);
      if (stored === "cs" || stored === "en") setLang(stored);
    })();
  }, []);

  if (hasToken === null) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return hasToken ? (
    <MyProfileRN onLoggedOut={refreshAuth} lang={lang} />
  ) : (
    <AuthFormRN onLoggedIn={refreshAuth} lang={lang} />
  );
}

/** ===== Styles ===== */
const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f0f0fff",
  },
  err: { color: "#c00", fontWeight: "700", textAlign: "center" },

  // Auth
  authWrap: { gap: 16, backgroundColor: "#0f0f0fff", flex: 1 },
  authSwitchRow: { flexDirection: "row", paddingTop: 35 },
  switchBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#2e2d2d",
    borderWidth: 1,
    borderColor: "#000",
  },
  switchBtnActive: { backgroundColor: "#8b0e0d" },
  switchText: { color: "#fff", fontWeight: "700" },
  form: { gap: 8, marginTop: 12, paddingHorizontal: 12 },
  label: { color: "#d0d0d0" },
  input: {
    backgroundColor: "#1a1919",
    borderWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    color: "#fff",
  },

  // Buttons (shared)
  primaryBtn: {
    backgroundColor: "#570303",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 10,
    backgroundColor: "#660c0cff",
  },
  secondaryBtnText: { color: "#e0e0e0", fontWeight: "700" },

  // Profile
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 20,
  },
  welcome: { color: "#fff", fontSize: 18, fontWeight: "800" },
  metaText: { color: "#d6d6d6", fontSize: 12, marginTop: 2 },
  sectionTitle: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },

  // Cards
  card: {
    flexDirection: "row",
    backgroundColor: "#191919",
    borderColor: "#151515",
    borderWidth: 2,
    borderRadius: 5,
    overflow: "hidden",
    height: 100,
  },
  cardImg: { width: 96, height: 96, backgroundColor: "#333" },
  cardTitle: { color: "#dcd7d7", fontWeight: "800", fontSize: 14 },
  deleteBtn: {},
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalCard: {
    backgroundColor: "#212121ff",
    borderRadius: 16,
    padding: 12,
    elevation: 4,
  },
  modalImg: {
    width: "100%",
    aspectRatio: 1.4,
    borderRadius: 12,
    backgroundColor: "#333",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: 10,
    color: "#dcd7d7ff",
  },
  section: {
    marginTop: 12,
    marginBottom: 4,
    fontWeight: "700",
    color: "#9b2929ff",
  },
  ingredient: {
    fontSize: 14,
    opacity: 0.9,
    marginVertical: 2,
    color: "#dcd7d7ff",
    flex: 1, // ← důležité: vezme si zbytek šířky
    flexWrap: "wrap", // ← text se může zalomit
    marginRight: 8, // trochu místa před tlačítkem
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: "#363636ff",
  },
  ingredientAddBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#171111ff",
    alignSelf: "flex-start", // ← ať se drží horního okraje textu
  },
});
