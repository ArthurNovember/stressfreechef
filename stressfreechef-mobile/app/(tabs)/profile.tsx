import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import { MaterialIcons } from "@expo/vector-icons";

import { t, Lang, LANG_KEY } from "../../i18n/strings";
import { API_BASE, fetchJSON } from "../../lib/api";
import { useTheme } from "../../theme/ThemeContext";

/* =========================
   TYPES
========================= */

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>["name"];

type PagedResponse<T> = {
  items?: T[];
  page?: number;
  pages?: number;
};

type Cover = { url: string; isVideo: boolean };

type RecipeLike = any;

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/* =========================
   CONSTS
========================= */

const BASE = API_BASE || "https://stressfreecheff-backend.onrender.com";
const TOKEN_KEY = "token";

const SAVED_LIMIT = 8;
const MY_LIMIT = 12;

/* =========================
   HELPERS 
========================= */

function isVideoUrl(url = "") {
  return /(\.mp4|\.webm|\.mov|\.m4v)(\?|#|$)/i.test(url);
}

function getCover(r: any): Cover {
  const url =
    r?.image?.url ||
    r?.imgSrc ||
    (r?.steps || []).find((s: any) => s?.type === "image" && s?.src)?.src ||
    (r?.steps || []).find((s: any) => s?.src)?.src ||
    "https://i.imgur.com/CZaFjz2.png";
  return { url, isVideo: isVideoUrl(url) };
}

function translateDifficulty(lang: Lang, diff: string) {
  if (lang === "cs") {
    if (diff === "Beginner") return "Začátečník";
    if (diff === "Intermediate") return "Pokročilý";
    if (diff === "Hard") return "Expert";
  }
  return diff;
}

function isUnauthorizedError(e: any) {
  const msg = String(e?.message ?? e ?? "");
  return (
    /\b401\b/i.test(msg) ||
    /unauthor/i.test(msg) ||
    (/token/i.test(msg) && /invalid|expire|platn/i.test(msg))
  );
}

/* =========================
  API
========================= */

async function getToken() {
  return (await AsyncStorage.getItem(TOKEN_KEY)) || "";
}
async function setToken(tkn: string) {
  await AsyncStorage.setItem(TOKEN_KEY, tkn);
}
async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}
async function loadLang(): Promise<Lang> {
  try {
    const stored = await AsyncStorage.getItem(LANG_KEY);
    return stored === "cs" || stored === "en" ? stored : "en";
  } catch {
    return "en";
  }
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

    const res = await fetch(`${BASE}/api/shopping-list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text: trimmed, shop: [] }),
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {}

    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

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

async function fetchMe(token: string): Promise<ActionResult<any>> {
  try {
    const me = await fetchJSON(`${BASE}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { ok: true, data: me || null };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function fetchMyRecipesPage(
  token: string,
  page: number
): Promise<ActionResult<PagedResponse<RecipeLike>>> {
  try {
    const res = await fetchJSON<PagedResponse<RecipeLike>>(
      `${BASE}/api/my-recipes?page=${page}&limit=${MY_LIMIT}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return {
      ok: true,
      data: {
        items: Array.isArray(res?.items) ? res.items : [],
        page: Number(res?.page) || page,
        pages: Number(res?.pages) || 1,
      },
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function fetchSavedRecipesPage(
  token: string,
  page: number
): Promise<ActionResult<PagedResponse<RecipeLike>>> {
  try {
    const res = await fetchJSON<PagedResponse<RecipeLike>>(
      `${BASE}/api/saved-community-recipes?page=${page}&limit=${SAVED_LIMIT}&sort=newest`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return {
      ok: true,
      data: {
        items: Array.isArray(res?.items) ? res.items : [],
        page,
        pages: Number(res?.pages) || 1,
      },
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function deleteMyRecipe(
  token: string,
  id: string
): Promise<ActionResult<true>> {
  try {
    const res = await fetch(`${BASE}/api/my-recipes/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${txt.slice(0, 200)}` };
    }

    return { ok: true, data: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function removeSavedRecipe(
  token: string,
  id: string
): Promise<ActionResult<true>> {
  try {
    const res = await fetch(`${BASE}/api/saved-community-recipes/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok && res.status !== 204) {
      const txt = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${txt.slice(0, 200)}` };
    }

    return { ok: true, data: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/* =========================
   UI: Rating
========================= */

function StarRatingDisplay({
  value,
  size = 16,
  count,
  textColor,
}: {
  value: number;
  size?: number;
  count?: number;
  textColor?: string;
}) {
  const val = Math.max(0, Math.min(5, value || 0));

  return (
    <View style={styles.ratingRow}>
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
          style={{
            color: textColor || "#dcd7d7ff",
            fontSize: 12,
            opacity: 0.8,
          }}
        >
          {val.toFixed(1)} ({count})
        </Text>
      ) : null}
    </View>
  );
}

/* =========================
   AUTH FORM
========================= */

function AuthFormRN({
  onLoggedIn,
  lang,
}: {
  onLoggedIn: () => void;
  lang: Lang;
}) {
  const { colors } = useTheme();

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
      const res = await fetch(`${BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json().catch(() => ({}));

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

      const res = await fetch(`${BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));
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
            { backgroundColor: colors.card, borderColor: colors.border },
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
          onPress={() => setMode("login")}
          style={[
            styles.switchBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
            mode === "login" && {
              backgroundColor: colors.pillActive,
              borderColor: colors.pillActive,
            },
          ]}
        >
          <Text style={[styles.switchText, { color: colors.text }]}>
            {t(lang, "profile", "authLogin")}
          </Text>
        </Pressable>
      </View>

      {mode === "signup" ? (
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
      ) : (
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

/* =========================
   PROFILE 
========================= */

function MyProfileRN({
  onLoggedOut,
  lang,
}: {
  onLoggedOut: () => void;
  lang: Lang;
}) {
  const { colors } = useTheme();

  const [user, setUser] = useState<any>(null);
  const [selected, setSelected] = useState<any | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [savedPage, setSavedPage] = useState(1);
  const [savedPages, setSavedPages] = useState(1);
  const [savedLoadingMore, setSavedLoadingMore] = useState(false);

  const [myItems, setMyItems] = useState<any[]>([]);
  const [myPage, setMyPage] = useState(1);
  const [myPages, setMyPages] = useState(1);
  const [myLoadingMore, setMyLoadingMore] = useState(false);

  const selectedCover = useMemo(
    () => (selected ? getCover(selected) : null),
    [selected]
  );

  const logout = useCallback(async () => {
    await clearToken();
    onLoggedOut();
  }, [onLoggedOut]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Missing token");

      const meRes = await fetchMe(token);
      if (meRes.ok) setUser(meRes.data);
      else setUser(null);

      setSavedPage(1);
      setSavedPages(1);
      setSavedItems([]);

      setMyPage(1);
      setMyPages(1);
      setMyItems([]);

      const [savedRes, myRes] = await Promise.all([
        fetchSavedRecipesPage(token, 1),
        fetchMyRecipesPage(token, 1),
      ]);

      if (!savedRes.ok) throw new Error(savedRes.error);
      if (!myRes.ok) throw new Error(myRes.error);

      setSavedItems(savedRes.data.items || []);
      setSavedPages(savedRes.data.pages || 1);

      setMyItems(myRes.data.items || []);
      setMyPages(myRes.data.pages || 1);
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

  const loadMoreSaved = useCallback(async () => {
    if (savedLoadingMore) return;
    if (savedPage >= savedPages) return;

    try {
      setSavedLoadingMore(true);
      const token = await getToken();
      const nextPage = savedPage + 1;

      const res = await fetchSavedRecipesPage(token, nextPage);
      if (!res.ok) throw new Error(res.error);

      setSavedItems((prev) => [...prev, ...(res.data.items || [])]);
      setSavedPage(nextPage);
      setSavedPages(res.data.pages || 1);
    } catch (e: any) {
      console.log("Load more saved failed:", e?.message || String(e));
    } finally {
      setSavedLoadingMore(false);
    }
  }, [savedLoadingMore, savedPage, savedPages]);

  const loadMoreMy = useCallback(async () => {
    if (myLoadingMore) return;
    if (myPage >= myPages) return;

    try {
      setMyLoadingMore(true);
      const token = await getToken();
      const nextPage = myPage + 1;

      const res = await fetchMyRecipesPage(token, nextPage);
      if (!res.ok) throw new Error(res.error);

      setMyItems((prev) => [...prev, ...(res.data.items || [])]);
      setMyPage(nextPage);
      setMyPages(res.data.pages || 1);
    } catch (e: any) {
      console.log("Load more my failed:", e?.message || String(e));
    } finally {
      setMyLoadingMore(false);
    }
  }, [myLoadingMore, myPage, myPages]);

  const confirmDeleteMy = useCallback(
    (id: string) => {
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
                const res = await deleteMyRecipe(token, id);
                if (!res.ok) throw new Error(res.error);

                setMyItems((prev) => prev.filter((r) => String(r?._id) !== id));
              } catch (e: any) {
                Alert.alert("Deletion failed", e?.message || String(e));
              }
            },
          },
        ]
      );
    },
    [lang]
  );

  const confirmRemoveSaved = useCallback(
    (id: string) => {
      Alert.alert(t(lang, "profile", "removeSavedTitle"), "", [
        { text: t(lang, "profile", "cancel"), style: "cancel" },
        {
          text: t(lang, "profile", "remove"),
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getToken();
              const res = await removeSavedRecipe(token, id);
              if (!res.ok) throw new Error(res.error);

              setSavedItems((prev) =>
                prev.filter((r) => String(r?._id || r?.id) !== id)
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
    },
    [lang]
  );

  const openDetailFromModal = useCallback(() => {
    if (!selected) return;

    const rid = String(selected?._id || selected?.id || "");
    router.push({
      pathname: "/recipe/[id]",
      params: {
        id: rid,
        recipe: JSON.stringify(selected),
        source: "profile",
      },
    });

    setSelected(null);
  }, [selected]);

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
      style={{ flex: 1, backgroundColor: colors.background, paddingTop: 15 }}
    >
      <View style={styles.profileHeader}>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={logout}
            style={[
              styles.secondaryBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
              {t(lang, "profile", "logout")}
            </Text>
          </Pressable>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {t(lang, "profile", "savedRecipesTitle")}
      </Text>

      {savedItems.length === 0 ? (
        <Text
          style={{ opacity: 0.7, paddingHorizontal: 16, color: colors.muted }}
        >
          {t(lang, "profile", "savedEmpty")}
        </Text>
      ) : null}

      <FlatList
        data={savedItems}
        horizontal
        onEndReached={loadMoreSaved}
        onEndReachedThreshold={0.6}
        keyExtractor={(r, idx) => String(r?._id || r?.id || idx)}
        contentContainerStyle={{ padding: 12, gap: 12 }}
        ListFooterComponent={
          savedLoadingMore ? (
            <ActivityIndicator style={{ marginHorizontal: 12 }} />
          ) : null
        }
        renderItem={({ item }) => {
          const cover = getCover(item);
          const rid = String(item?._id || item?.id || "");

          return (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
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
                    textColor={colors.secondaryText}
                  />
                </View>
              </Pressable>

              <Pressable
                onPress={() => confirmRemoveSaved(rid)}
                style={styles.iconBtn}
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

      {myItems.length === 0 ? (
        <Text
          style={{ opacity: 0.7, paddingHorizontal: 16, color: colors.muted }}
        >
          {t(lang, "profile", "myEmpty")}
        </Text>
      ) : null}

      <FlatList
        data={myItems}
        onEndReached={loadMoreMy}
        onEndReachedThreshold={0.6}
        keyExtractor={(r) => String(r?._id || r?.id)}
        contentContainerStyle={{ padding: 12, gap: 12 }}
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
                { backgroundColor: colors.card, borderColor: colors.border },
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
                    textColor={colors.secondaryText}
                  />
                </View>
              </Pressable>

              <Pressable
                onPress={() => confirmDeleteMy(rid)}
                style={styles.iconBtn}
              >
                <MaterialIcons name="close" size={18} color={colors.text} />
              </Pressable>
            </View>
          );
        }}
      />

      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
              {selectedCover?.isVideo ? (
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

              {(typeof selected?.ratingAvg === "number" ||
                typeof selected?.rating === "number") && (
                <StarRatingDisplay
                  value={selected?.ratingAvg ?? selected?.rating ?? 0}
                  count={selected?.ratingCount}
                  size={20}
                  textColor={colors.secondaryText}
                />
              )}

              {selected?.ingredients?.length ? (
                <>
                  <Text style={[styles.section, { color: colors.pillActive }]}>
                    {t(lang, "profile", "ingredients")}
                  </Text>

                  {selected.ingredients.map((ing: string, i: number) => (
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
                onPress={openDetailFromModal}
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

/* =========================
   ROOT
========================= */

export default function ProfileScreen() {
  const { colors } = useTheme();

  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [lang, setLang] = useState<Lang>("en");

  const refreshAuth = useCallback(async () => {
    const tkn = await getToken();
    setHasToken(Boolean(tkn));
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    (async () => setLang(await loadLang()))();
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

/* =========================
   STYLES
========================= */

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f0f0fff",
  },
  err: { fontWeight: "700", textAlign: "center" },

  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },

  authWrap: { gap: 16, flexGrow: 1, paddingBottom: 24 },
  authSwitchRow: { flexDirection: "row", paddingTop: 35 },
  switchBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderWidth: 1,
  },
  switchText: { fontWeight: "700" },
  form: { gap: 8, marginTop: 12, paddingHorizontal: 12 },
  label: { opacity: 0.9 },
  input: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },

  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  primaryBtnText: { fontWeight: "700" },
  secondaryBtn: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 10,
  },
  secondaryBtnText: { fontWeight: "700" },

  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 20,
  },
  metaText: { fontSize: 12, marginTop: 2 },
  sectionTitle: {
    fontWeight: "800",
    fontSize: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },

  card: {
    flexDirection: "row",
    borderWidth: 2,
    borderRadius: 6,
    overflow: "hidden",
    height: 100,
    alignItems: "center",
  },
  cardImg: { width: 96, height: 96, backgroundColor: "#333" },
  cardTitle: { fontWeight: "800", fontSize: 14 },

  iconBtn: {
    width: 40,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalCard: {
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
  modalTitle: { fontSize: 20, fontWeight: "800", marginTop: 10 },

  section: { marginTop: 12, marginBottom: 4, fontWeight: "700" },

  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  ingredient: {
    fontSize: 14,
    opacity: 0.9,
    marginVertical: 2,
    flex: 1,
    flexWrap: "wrap",
    marginRight: 8,
  },
  ingredientAddBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
});
