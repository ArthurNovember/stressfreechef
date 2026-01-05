import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useScrollToTop, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";

import type { ComponentProps } from "react";
import { MaterialIcons } from "@expo/vector-icons";

import { API_BASE, fetchJSON } from "../../lib/api";
import { t, Lang, LANG_KEY } from "../../i18n/strings";
import { useTheme } from "../../theme/ThemeContext";

/* =========================
   TYPES
========================= */

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

type Step = {
  type: "image" | "video" | "text";
  src?: string;
  description: string;
  descriptionCs?: string;
};

type Recipe = {
  _id?: string;
  id?: string;
  title: string;
  titleCs?: string;

  imgSrc: string;

  difficulty: "Beginner" | "Intermediate" | "Hard" | string;
  time: string;

  ingredients?: string[];
  ingredientsCs?: string[];

  steps?: Step[];

  rating?: number;
  ratingAvg?: number;
  ratingCount?: number;

  createdAt?: string;
};

type ActiveTab = "EASIEST" | "NEWEST" | "FAVORITE" | "RANDOM";

type CommunityStatsMap = Record<
  string,
  { id: string; avg: number; count: number }
>;

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/* =========================
   CONSTS
========================= */

const TOKEN_KEY = "token";
const GUEST_SHOPPING_KEY = "shopping_guest_items";
const difficultyOrder = ["Beginner", "Intermediate", "Hard"] as const;

/* =========================
   HELPERS 
========================= */

function getBaseId(r: Recipe | null | undefined) {
  return String(r?._id || r?.id || "");
}

function translateDifficulty(lang: Lang, diff: string) {
  if (lang === "cs") {
    if (diff === "Beginner") return "Začátečník";
    if (diff === "Intermediate") return "Pokročilý";
    if (diff === "Hard") return "Expert";
  }
  return diff;
}

function getRecipeTitle(r: Recipe, lang: Lang) {
  if (lang === "cs" && r.titleCs) return r.titleCs;
  return r.title;
}

function getRecipeIngredients(r: Recipe, lang: Lang): string[] {
  if (
    lang === "cs" &&
    Array.isArray(r.ingredientsCs) &&
    r.ingredientsCs.length
  ) {
    return r.ingredientsCs;
  }
  return r.ingredients || [];
}

function getRatingFromStatsOrRecipe(
  rid: string,
  recipe: Recipe,
  statsMap: CommunityStatsMap
) {
  const stats = rid ? statsMap[rid] : undefined;

  const ratingVal =
    typeof stats?.avg === "number"
      ? stats.avg
      : typeof recipe.ratingAvg === "number"
      ? recipe.ratingAvg
      : recipe.rating || 0;

  const ratingCount =
    typeof stats?.count === "number"
      ? stats.count
      : typeof recipe.ratingCount === "number"
      ? recipe.ratingCount
      : undefined;

  return { ratingVal, ratingCount, communityId: stats?.id };
}

function sortNewest(src: Recipe[]) {
  return src
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    );
}

function sortEasiest(src: Recipe[]) {
  return src
    .slice()
    .sort(
      (a, b) =>
        difficultyOrder.indexOf((a.difficulty || "") as any) -
        difficultyOrder.indexOf((b.difficulty || "") as any)
    );
}

function sortFavoriteByRating(src: Recipe[], statsMap: CommunityStatsMap) {
  return src.slice().sort((a, b) => {
    const ridA = getBaseId(a);
    const ridB = getBaseId(b);

    const ratingA = getRatingFromStatsOrRecipe(ridA, a, statsMap).ratingVal;
    const ratingB = getRatingFromStatsOrRecipe(ridB, b, statsMap).ratingVal;

    return ratingB - ratingA;
  });
}

function shuffle<T>(src: T[]) {
  const arr = src.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* =========================
   API
========================= */

async function getToken(): Promise<string> {
  try {
    const tkn = await AsyncStorage.getItem(TOKEN_KEY);
    return tkn || "";
  } catch {
    return "";
  }
}

async function loadLang(): Promise<Lang> {
  try {
    const stored = await AsyncStorage.getItem(LANG_KEY);
    return stored === "en" || stored === "cs" ? stored : "en";
  } catch {
    return "en";
  }
}

async function fetchOfficialRecipes(): Promise<ActionResult<Recipe[]>> {
  if (!API_BASE) return { ok: false, error: "Missing API_BASE" };

  try {
    const data = await fetchJSON<Recipe[]>(`${API_BASE}/api/recipes`);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Failed to load recipes." };
  }
}

async function ensureCommunityStatsForOfficialRecipes(
  baseIds: string[]
): Promise<ActionResult<CommunityStatsMap>> {
  if (!API_BASE) return { ok: false, error: "Missing API_BASE" };

  if (!baseIds.length) return { ok: true, data: {} };

  try {
    const pairs = await Promise.all(
      baseIds.map(async (rid) => {
        try {
          const data = await fetchJSON<any>(
            `${API_BASE}/api/community-recipes/ensure-from-recipe/${rid}`,
            { method: "POST" }
          );

          if (!data?._id) return null;

          return [
            rid,
            {
              id: String(data._id),
              avg: Number(data.ratingAvg || 0),
              count: Number(data.ratingCount || 0),
            },
          ] as const;
        } catch {
          return null;
        }
      })
    );

    const next: CommunityStatsMap = {};
    for (const p of pairs) {
      if (!p) continue;
      const [rid, stats] = p;
      next[rid] = stats;
    }

    return { ok: true, data: next };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.message || "Failed to build community stats.",
    };
  }
}

async function loadSavedCommunityRecipes(): Promise<
  ActionResult<{ communityIds: string[]; baseIds: string[] }>
> {
  if (!API_BASE) return { ok: false, error: "Missing API_BASE" };

  const token = await getToken();
  if (!token) return { ok: true, data: { communityIds: [], baseIds: [] } };

  try {
    const savedRaw = await fetchJSON<any>(
      `${API_BASE}/api/saved-community-recipes`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const saved = Array.isArray(savedRaw)
      ? savedRaw
      : Array.isArray(savedRaw?.items)
      ? savedRaw.items
      : [];

    const communityIds: string[] = [];
    const baseIds: string[] = [];

    for (const r of saved) {
      const cid = String((r as any)._id || (r as any).id || "");
      if (cid) communityIds.push(cid);

      const src = (r as any).sourceRecipeId;
      if (src) {
        const baseStr = String(
          typeof src === "object" && src._id ? src._id : src
        );
        if (baseStr) baseIds.push(baseStr);
      }
    }

    return { ok: true, data: { communityIds, baseIds } };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Failed to load saved recipes." };
  }
}

async function toggleSaveOfficialRecipe(
  lang: Lang,
  baseRecipeId: string,
  savedCommunityIds: string[]
): Promise<ActionResult<{ nextSaved: boolean; communityId: string }>> {
  if (!API_BASE) return { ok: false, error: "Missing API_BASE" };

  const token = await getToken();
  if (!token) {
    Alert.alert(
      t(lang, "home", "loginRequiredTitle"),
      t(lang, "home", "loginRequiredMsg")
    );
    return { ok: false, error: "Login required" };
  }

  try {
    const ensure = await fetchJSON<any>(
      `${API_BASE}/api/community-recipes/ensure-from-recipe/${baseRecipeId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const communityId = String(ensure?._id || "");
    if (!communityId)
      return { ok: false, error: "Failed to ensure community recipe." };

    if (savedCommunityIds.includes(communityId)) {
      const res = await fetch(
        `${API_BASE}/api/saved-community-recipes/${communityId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok && res.status !== 204) {
        return { ok: false, error: `Failed to unsave (HTTP ${res.status})` };
      }

      return { ok: true, data: { nextSaved: false, communityId } };
    }

    await fetchJSON(`${API_BASE}/api/saved-community-recipes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipeId: communityId }),
    });

    return { ok: true, data: { nextSaved: true, communityId } };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Failed to save/unsave recipe." };
  }
}

async function addIngredientToShopping(ingredient: string, lang: Lang) {
  const trimmed = ingredient.trim();
  if (!trimmed) return;

  try {
    const token = await getToken();

    if (!token) {
      const stored = await AsyncStorage.getItem(GUEST_SHOPPING_KEY);
      let list: any[] = [];

      if (stored) {
        try {
          list = JSON.parse(stored);
        } catch {
          list = [];
        }
      }

      const newItem = {
        _id: `guest-${Date.now()}`,
        text: trimmed,
        shop: [],
        checked: false,
        createdAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem(
        GUEST_SHOPPING_KEY,
        JSON.stringify([...list, newItem])
      );

      Alert.alert(
        lang === "cs" ? "Přidáno" : "Added",
        lang === "cs"
          ? `"${trimmed}" bylo přidáno do nákupního seznamu.`
          : `"${trimmed}" was added to your shopping list.`
      );
      return;
    }

    const res = await fetch(`${API_BASE}/api/shopping-list`, {
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
      lang === "cs" ? "Přidáno" : "Added",
      lang === "cs"
        ? `"${trimmed}" bylo přidáno do nákupního seznamu.`
        : `"${trimmed}" was added to your shopping list.`
    );
  } catch (e: any) {
    Alert.alert(t(lang, "home", "addFailedTitle"), e?.message || String(e));
  }
}

/* =========================
   UI PARTS
========================= */

function StarRatingDisplay({
  value,
  count,
  size = 14,
}: {
  value: number;
  count?: number;
  size?: number;
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

      <Text style={styles.ratingValue}>
        {val.toFixed(1)}
        {typeof count === "number" && count > 0 ? ` (${count})` : ""}
      </Text>
    </View>
  );
}

/* =========================
   SCREEN
========================= */

export default function HomeScreen() {
  const { colors } = useTheme();

  const [lang, setLang] = useState<Lang>("en");

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [list, setList] = useState<Recipe[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("NEWEST");

  const [savedCommunityIds, setSavedCommunityIds] = useState<string[]>([]);
  const [savedBaseIds, setSavedBaseIds] = useState<string[]>([]);
  const [communityStats, setCommunityStats] = useState<CommunityStatsMap>({});

  const [selected, setSelected] = useState<Recipe | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const listRef = useRef<FlatList<Recipe>>(null);
  useScrollToTop(listRef);

  /* =========================
   EFFECTS
========================= */

  useEffect(() => {
    (async () => setLang(await loadLang()))();
  }, []);

  useEffect(() => {
    let aborted = false;

    (async () => {
      setLoading(true);
      setErr(null);

      const res = await fetchOfficialRecipes();
      if (aborted) return;

      if (!res.ok) {
        setErr(res.error);
        setLoading(false);
        return;
      }

      setRecipes(res.data);
      setList(sortNewest(res.data));
      setLoading(false);
    })();

    return () => {
      aborted = true;
    };
  }, []);

  useEffect(() => {
    const baseIds = Array.from(new Set(recipes.map(getBaseId).filter(Boolean)));

    let cancelled = false;

    (async () => {
      const res = await ensureCommunityStatsForOfficialRecipes(baseIds);
      if (cancelled) return;

      if (res.ok) setCommunityStats(res.data);
      else setCommunityStats({});
    })();

    return () => {
      cancelled = true;
    };
  }, [recipes]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      (async () => {
        const res = await loadSavedCommunityRecipes();
        if (!alive) return;

        if (!res.ok) {
          setSavedCommunityIds([]);
          setSavedBaseIds([]);
          return;
        }

        setSavedCommunityIds(res.data.communityIds);
        setSavedBaseIds(res.data.baseIds);
      })();

      return () => {
        alive = false;
      };
    }, [])
  );

  /* =========================
     EXTRA
  ========================= */

  const selectedBaseId = selected ? getBaseId(selected) : "";
  const selectedStats = selectedBaseId
    ? communityStats[selectedBaseId]
    : undefined;

  const selectedRatingVal =
    selectedStats && typeof selectedStats.avg === "number"
      ? selectedStats.avg
      : selected && typeof selected.ratingAvg === "number"
      ? selected.ratingAvg
      : selected?.rating || 0;

  const selectedRatingCount =
    selectedStats && typeof selectedStats.count === "number"
      ? selectedStats.count
      : selected && typeof selected.ratingCount === "number"
      ? selected.ratingCount
      : undefined;

  const selectedIsSaved = selectedBaseId
    ? savedBaseIds.includes(selectedBaseId)
    : false;

  const selectedIngredients = selected
    ? getRecipeIngredients(selected, lang)
    : [];

  /* =========================
     HANDLERS
  ========================= */

  function applyTab(next: ActiveTab, src = recipes) {
    setActiveTab(next);

    if (next === "NEWEST") setList(sortNewest(src));
    else if (next === "EASIEST") setList(sortEasiest(src));
    else if (next === "FAVORITE")
      setList(sortFavoriteByRating(src, communityStats));
    else setList(shuffle(src));
  }

  async function handleToggleSaveSelected() {
    if (!selected) return;

    const baseId = getBaseId(selected);
    if (!baseId) return;

    const res = await toggleSaveOfficialRecipe(lang, baseId, savedCommunityIds);
    if (!res.ok) {
      if (res.error !== "Login required") {
        Alert.alert(t(lang, "home", "addFailedTitle"), res.error);
      }
      return;
    }

    const { nextSaved, communityId } = res.data;

    setSavedCommunityIds((prev) => {
      if (nextSaved)
        return prev.includes(communityId) ? prev : [...prev, communityId];
      return prev.filter((x) => x !== communityId);
    });

    setSavedBaseIds((prev) => {
      if (nextSaved) return prev.includes(baseId) ? prev : [...prev, baseId];
      return prev.filter((x) => x !== baseId);
    });
  }

  function handleOpenRecipeFromModal() {
    if (!selected) return;

    const rid = getBaseId(selected);
    if (!rid) return;

    const stats = rid ? communityStats[rid] : undefined;

    router.push({
      pathname: "/recipe/[id]",
      params: {
        id: rid,
        recipe: JSON.stringify(selected),
        communityRecipeId: stats?.id ? String(stats.id) : undefined,
        source: "home",
      },
    });

    setSelected(null);
  }

  /* =========================
     RENDER
  ========================= */

  const renderRecipeCard = ({ item }: { item: Recipe }) => {
    const rid = getBaseId(item);

    const { ratingVal, ratingCount } = getRatingFromStatsOrRecipe(
      rid,
      item,
      communityStats
    );

    return (
      <Pressable
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        onPress={() => setSelected(item)}
      >
        <Image source={{ uri: item.imgSrc }} style={styles.img} />

        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {getRecipeTitle(item, lang)}
        </Text>

        <StarRatingDisplay value={ratingVal} count={ratingCount} />

        <Text style={[styles.meta, { color: colors.secondaryText }]}>
          {t(lang, "home", "difficulty")}:{" "}
          {translateDifficulty(lang, item.difficulty)}
        </Text>

        <Text style={[styles.meta, { color: colors.secondaryText }]}>
          {t(lang, "home", "time")}: {item.time} ⏱️
        </Text>
      </Pressable>
    );
  };

  /* =========================
     GUARDS
  ========================= */

  if (!API_BASE) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.err, { color: colors.danger }]}>
          Missing EXPO_PUBLIC_API_BASE in .env
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8, color: colors.text }}>
          {t(lang, "home", "loadingRecipes")}
        </Text>
      </View>
    );
  }

  if (err) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.err, { color: colors.danger }]}>Error: {err}</Text>
      </View>
    );
  }

  /* =========================
     UI
  ========================= */

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={listRef}
        data={list}
        keyExtractor={(r) => String(r._id || r.id)}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        ListHeaderComponent={
          <View>
            <View style={{ height: 33, backgroundColor: colors.background }} />

            <View style={{ alignItems: "center", flexDirection: "row" }}>
              <Pressable
                onPress={() => router.push("/settings")}
                style={{
                  paddingHorizontal: 12,
                  height: 100,
                  justifyContent: "center",
                  backgroundColor: "#640505ff",
                  borderColor: colors.border,
                  borderWidth: 4,
                  borderRightWidth: 0,
                  borderLeftWidth: 0,
                  borderBottomWidth: 0,
                }}
              >
                <MaterialIcons name="menu" size={28} color="#edededff" />
              </Pressable>

              <Text
                style={{
                  flex: 1,
                  fontSize: 38,
                  lineHeight: 100,
                  borderWidth: 4,
                  borderLeftWidth: 0,
                  borderRightWidth: 0,
                  height: 100,
                  textAlign: "center",
                  backgroundColor: colors.card,
                  color: colors.text,
                  borderColor: colors.border,
                  fontFamily: "Metropolis",
                  zIndex: 1000,
                  borderBottomWidth: 0,
                }}
              >
                Stress Free Chef
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                paddingBottom: 1,
                borderTopWidth: 4,
                borderColor: colors.border,
              }}
            >
              <Pressable
                style={[
                  styles.chip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  activeTab === "NEWEST" && {
                    backgroundColor: colors.pillActive,
                    borderColor: colors.pillActive,
                  },
                ]}
                onPress={() => applyTab("NEWEST")}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: colors.text },
                    activeTab === "NEWEST" && styles.chipTextActive,
                  ]}
                >
                  {t(lang, "home", "newest")}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.chip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  activeTab === "EASIEST" && {
                    backgroundColor: colors.pillActive,
                    borderColor: colors.pillActive,
                  },
                ]}
                onPress={() => applyTab("EASIEST")}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: colors.text },
                    activeTab === "EASIEST" && styles.chipTextActive,
                  ]}
                >
                  {t(lang, "home", "easiest")}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.chip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  activeTab === "FAVORITE" && {
                    backgroundColor: colors.pillActive,
                    borderColor: colors.pillActive,
                  },
                ]}
                onPress={() => applyTab("FAVORITE")}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: colors.text },
                    activeTab === "FAVORITE" && styles.chipTextActive,
                  ]}
                >
                  {t(lang, "home", "favorite")}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.chip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  activeTab === "RANDOM" && {
                    backgroundColor: colors.pillActive,
                    borderColor: colors.pillActive,
                  },
                ]}
                onPress={() => applyTab("RANDOM")}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: colors.text },
                    activeTab === "RANDOM" && styles.chipTextActive,
                  ]}
                >
                  {t(lang, "home", "random")}
                </Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={renderRecipeCard}
      />

      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            {selected && (
              <Pressable
                style={[
                  styles.saveFloatingBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  selectedIsSaved && {
                    backgroundColor: colors.pillActive,
                    borderColor: colors.pillActive,
                  },
                ]}
                onPress={handleToggleSaveSelected}
              >
                <Text
                  style={[styles.saveFloatingBtnText, { color: colors.text }]}
                >
                  {selectedIsSaved
                    ? t(lang, "home", "saved")
                    : t(lang, "home", "save")}
                </Text>
              </Pressable>
            )}

            <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
              <Image
                source={{ uri: selected?.imgSrc }}
                style={styles.modalImg}
              />

              <View style={styles.modalHeaderRow}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {selected ? getRecipeTitle(selected, lang) : ""}
                </Text>
              </View>

              {selected && (
                <StarRatingDisplay
                  value={selectedRatingVal}
                  count={selectedRatingCount}
                />
              )}

              <Text style={[styles.modalMeta, { color: colors.secondaryText }]}>
                {t(lang, "home", "difficulty")}:{" "}
                {translateDifficulty(lang, selected?.difficulty || "—")}
              </Text>

              <Text style={[styles.modalMeta, { color: colors.secondaryText }]}>
                {t(lang, "home", "time")}: {selected?.time || "—"} ⏱️
              </Text>

              {selectedIngredients.length ? (
                <>
                  <Text style={[styles.section, { color: colors.pillActive }]}>
                    {t(lang, "home", "ingredients")}
                  </Text>

                  {selectedIngredients.map((ing, i) => (
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
                          {
                            backgroundColor: colors.pillActive,
                            borderColor: colors.pillActive,
                          },
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
                onPress={handleOpenRecipeFromModal}
              >
                <Text style={styles.primaryBtnText}>
                  {t(lang, "home", "getStarted")}
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
                  {t(lang, "home", "close")}
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
   STYLES
========================= */

const styles = StyleSheet.create({
  container: { flex: 1 },

  card: {
    flex: 1,
    borderWidth: 2,
    padding: 10,
    gap: 6,
    elevation: 1,
  },
  img: {
    width: "100%",
    aspectRatio: 1.3,
    borderRadius: 10,
    backgroundColor: "#eee",
  },
  title: { fontSize: 14, fontWeight: "700" },
  meta: { fontSize: 12, opacity: 0.7 },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#211d1dff",
  },
  err: { fontWeight: "700", textAlign: "center" },

  chip: {
    paddingHorizontal: 8,
    paddingVertical: 16,
    flex: 1,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    backgroundColor: "#1a1919ff",
  },
  chipText: {
    fontWeight: "700",
    letterSpacing: 0.3,
    fontSize: 13,
    textAlign: "center",
  },
  chipTextActive: { color: "#ffffff" },

  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  ratingValue: {
    fontSize: 11,
    color: "#ccc",
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    borderRadius: 16,
    padding: 12,
    elevation: 4,
    position: "relative",
  },
  modalImg: {
    width: "100%",
    aspectRatio: 1.4,
    borderRadius: 12,
    backgroundColor: "#eee",
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: 10,
  },
  modalMeta: { marginTop: 4, fontSize: 13 },

  section: {
    marginTop: 12,
    marginBottom: 4,
    fontWeight: "700",
  },

  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 2,
    borderBottomWidth: 1,
    padding: 5,
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
    borderWidth: 1,
    alignSelf: "flex-start",
  },

  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },

  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryBtnText: { fontWeight: "700" },

  saveFloatingBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 50,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  saveFloatingBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
