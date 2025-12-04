import { useRef } from "react";
import { useScrollToTop } from "@react-navigation/native"; // ← tohle přidej
import { t, Lang, LANG_KEY } from "../../i18n/strings";
import { useTheme } from "../../theme/ThemeContext";

import {
  useFonts,
  Merienda_400Regular,
  Merienda_700Bold,
} from "@expo-google-fonts/merienda";

import { useEffect, useState, useCallback } from "react";
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
import { API_BASE, fetchJSON } from "../../lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import type { ComponentProps } from "react"; // ⬅️ nový typ
import { MaterialIcons } from "@expo/vector-icons"; // ⬅️ ikony

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

function StarRatingDisplay({
  value,
  count,
}: {
  value: number;
  count?: number;
}) {
  const val = Math.max(0, Math.min(5, value || 0));

  return (
    <View style={styles.ratingRow}>
      <View style={{ flexDirection: "row" }}>
        {Array.from({ length: 5 }, (_, i) => {
          const diff = val - i;

          let icon: MaterialIconName = "star-border";

          if (diff >= 0.75) {
            icon = "star"; // plná hvězda
          } else if (diff >= 0.25) {
            icon = "star-half"; // půl hvězda
          } // jinak zůstane star-border

          return (
            <MaterialIcons
              key={i}
              name={icon}
              size={14} // klidně si doladíš (16 jako v Explore)
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

type Step = {
  type: "image" | "video" | "text";
  src?: string;
  description: string;
};
type Recipe = {
  _id?: string;
  id?: string;
  title: string;
  imgSrc: string;
  difficulty: "Beginner" | "Intermediate" | "Hard" | string;
  time: string;
  ingredients?: string[];
  steps?: Step[];
  rating?: number;
  ratingAvg?: number; // ⬅️ přidej
  ratingCount?: number; // ⬅️ přidej
  createdAt?: string;
};

const TOKEN_KEY = "token";

async function getToken() {
  try {
    const t = await AsyncStorage.getItem(TOKEN_KEY);
    return t || "";
  } catch {
    return "";
  }
}

export default function HomeScreen() {
  const { colors } = useTheme(); // 💡 tady máš theme barvy
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Recipe | null>(null);

  const difficultyOrder = ["Beginner", "Intermediate", "Hard"];
  const [list, setList] = useState<Recipe[]>([]); // zobrazovaný seznam
  const [active, setActive] = useState<
    "EASIEST" | "NEWEST" | "FAVORITE" | "RANDOM"
  >("NEWEST");

  const [savedIds, setSavedIds] = useState<string[]>([]);

  const [savedBaseIds, setSavedBaseIds] = useState<string[]>([]);

  const [communityStats, setCommunityStats] = useState<
    Record<string, { id: string; avg: number; count: number }>
  >({});

  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(LANG_KEY);
        if (stored === "en" || stored === "cs") {
          setLang(stored);
        }
      } catch {
        // když něco selže, necháme default "en"
      }
    })();
  }, []);

  function getRecipeTitle(r: Recipe, lang: Lang) {
    if (lang === "cs" && (r as any).titleCs) {
      return (r as any).titleCs;
    }
    return r.title;
  }

  function getRecipeIngredients(r: Recipe, lang: Lang): string[] {
    if (lang === "cs" && (r as any).ingredientsCs?.length) {
      return (r as any).ingredientsCs as string[];
    }
    return r.ingredients || [];
  }

  function getStepDescription(step: any, lang: Lang): string {
    if (lang === "cs" && step.descriptionCs) {
      return step.descriptionCs;
    }
    return step.description;
  }

  const selectedBaseId = selected
    ? String((selected as any)._id || (selected as any).id || "")
    : "";

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

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const data = await fetchJSON<Recipe[]>(`${API_BASE}/api/recipes`);

        if (!aborted) {
          setRecipes(data || []);
          setList(
            (data || [])
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.createdAt || 0).getTime() -
                  new Date(a.createdAt || 0).getTime()
              )
          ); // default NEWEST
        }
      } catch (e: any) {
        if (!aborted) setErr(e?.message || "Failed to load recipes.");
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, []);

  // ⭐ Stejné jako na webu – zajistíme community kopie + ratingy pro všechny ofiko recepty
  useEffect(() => {
    const ids = Array.from(
      new Set(
        (recipes || [])
          .map((r) => String(r?._id || r?.id || ""))
          .filter(Boolean)
      )
    );

    if (ids.length === 0) {
      setCommunityStats({});
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const pairs = await Promise.all(
          ids.map(async (rid) => {
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

        if (cancelled) return;

        const next: Record<string, { id: string; avg: number; count: number }> =
          {};
        for (const pair of pairs) {
          if (!pair) continue;
          const [rid, stats] = pair;
          next[rid] = stats;
        }
        setCommunityStats(next);
      } catch {
        if (!cancelled) setCommunityStats({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [recipes]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        try {
          const token = await getToken();
          if (!token) {
            if (active) {
              setSavedIds([]);
              setSavedBaseIds([]);
            }
            return;
          }

          const saved = await fetchJSON<any[]>(
            `${API_BASE}/api/saved-community-recipes`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          const communityIds: string[] = [];
          const baseIds: string[] = [];

          if (Array.isArray(saved)) {
            for (const r of saved) {
              // ID community receptu
              const cid = String((r as any)._id || (r as any).id || "");
              if (cid) communityIds.push(cid);

              // base ID (Recipe) přes sourceRecipeId – u ofiko receptů
              const src = (r as any).sourceRecipeId;
              if (src) {
                const baseStr = String(
                  typeof src === "object" && src._id ? src._id : src
                );
                if (baseStr) baseIds.push(baseStr);
              }
            }
          }

          if (active) {
            setSavedIds(communityIds);
            setSavedBaseIds(baseIds);
          }
        } catch {
          if (active) {
            setSavedIds([]);
            setSavedBaseIds([]);
          }
        }
      })();

      return () => {
        active = false;
      };
    }, [])
  );

  async function toggleSaveOfficial(recipe: Recipe | null) {
    if (!recipe) return;

    const baseId = String(recipe._id || recipe.id || "");
    if (!baseId) return;

    const token = await getToken();
    if (!token) {
      Alert.alert(
        t(lang, "home", "loginRequiredTitle"),
        t(lang, "home", "loginRequiredMsg")
      );
      return;
    }

    // 1) Zajistit community verzi
    const ensure = await fetchJSON<any>(
      `${API_BASE}/api/community-recipes/ensure-from-recipe/${baseId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const communityId = String(ensure?._id || "");
    if (!communityId) return;

    // 2) Pokud už uložený → UNSAVE
    // UNSAVE větev v toggleSaveOfficial
    if (savedIds.includes(communityId)) {
      const res = await fetch(
        `${API_BASE}/api/saved-community-recipes/${communityId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok && res.status !== 204) {
        console.warn("Failed to unsave recipe", res.status);
      }

      setSavedIds((prev) => prev.filter((id) => id !== communityId));
      setSavedBaseIds((prev) => prev.filter((id) => id !== baseId));
      return;
    }

    // 3) Jinak uložit
    await fetchJSON(`${API_BASE}/api/saved-community-recipes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipeId: communityId }),
    });

    setSavedIds((prev) =>
      prev.includes(communityId) ? prev : [...prev, communityId]
    );
    setSavedBaseIds((prev) =>
      prev.includes(baseId) ? prev : [...prev, baseId]
    );
  }

  async function addIngredientToShopping(ingredient: string) {
    const trimmed = ingredient.trim();
    if (!trimmed) return;

    try {
      const token = await getToken();

      // ⭐⭐⭐ GUEST MODE – stejný princip jako shopping.tsx ⭐⭐⭐
      if (!token) {
        const GUEST_KEY = "shopping_guest_items";

        const stored = await AsyncStorage.getItem(GUEST_KEY);
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

        const updated = [...list, newItem];
        await AsyncStorage.setItem(GUEST_KEY, JSON.stringify(updated));

        Alert.alert(
          lang === "cs" ? "Přidáno" : "Added",
          lang === "cs"
            ? `"${trimmed}" bylo přidáno do nákupního seznamu.`
            : `"${trimmed}" was added to your shopping list.`
        );

        return;
      }

      // ⭐⭐⭐ NORMAL BACKEND MODE (beze změn) ⭐⭐⭐
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
      } catch {}

      if (!res.ok) {
        const msg = data?.error || `HTTP ${res.status}`;
        throw new Error(msg);
      }

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

  function sortEasiest(src: Recipe[]) {
    return src
      .slice()
      .sort(
        (a, b) =>
          difficultyOrder.indexOf(a.difficulty || "") -
          difficultyOrder.indexOf(b.difficulty || "")
      );
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
  function sortFavorite(src: Recipe[]) {
    return src.slice().sort((a, b) => {
      const ridA = String(a._id || a.id || "");
      const ridB = String(b._id || b.id || "");

      const statsA = ridA ? communityStats[ridA] : undefined;
      const statsB = ridB ? communityStats[ridB] : undefined;

      const ratingA =
        typeof statsA?.avg === "number"
          ? statsA.avg
          : typeof a.ratingAvg === "number"
          ? a.ratingAvg
          : a.rating || 0;

      const ratingB =
        typeof statsB?.avg === "number"
          ? statsB.avg
          : typeof b.ratingAvg === "number"
          ? b.ratingAvg
          : b.rating || 0;

      // seřadit od nejvyššího ratingu po nejnižší
      return ratingB - ratingA;
    });
  }

  function shuffle(src: Recipe[]) {
    const arr = src.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const listRef = useRef<FlatList<Recipe>>(null);
  useScrollToTop(listRef);

  const [fontsLoaded] = useFonts({
    Merienda_400Regular,
    Merienda_700Bold,
  });

  const ingredients = selected ? getRecipeIngredients(selected, lang) : [];

  function translateDifficulty(lang: Lang, diff: string) {
    if (lang === "cs") {
      if (diff === "Beginner") return "Začátečník";
      if (diff === "Intermediate") return "Pokročilý";
      if (diff === "Hard") return "Expert";
    }
    return diff;
  }

  if (!API_BASE) {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>Missing EXPO_PUBLIC_API_BASE in .env</Text>
      </View>
    );
  }
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8, color: colors.text }}>
          {" "}
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={listRef}
        data={list}
        keyExtractor={(r) => String(r._id || r.id)}
        numColumns={2}
        columnWrapperStyle={{
          justifyContent: "space-between",
        }}
        ListHeaderComponent={
          <View>
            <View style={{ height: 33, backgroundColor: colors.background }} />

            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
              }}
            >
              {/* SETTINGS / MENU BUTTON VLEVO */}
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

              {/* NADPIS */}
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

            <View>
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
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                    active === "NEWEST" && {
                      backgroundColor: colors.pillActive,
                      borderColor: colors.pillActive,
                    },
                  ]}
                  onPress={() => {
                    setActive("NEWEST");
                    setList(sortNewest(recipes));
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.text },
                      active === "NEWEST" && styles.chipTextActive,
                    ]}
                  >
                    {t(lang, "home", "newest")}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.chip,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                    active === "EASIEST" && {
                      backgroundColor: colors.pillActive,
                      borderColor: colors.pillActive,
                    },
                  ]}
                  onPress={() => {
                    setActive("EASIEST");
                    setList(sortEasiest(recipes));
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.text },
                      active === "EASIEST" && styles.chipTextActive,
                    ]}
                  >
                    {t(lang, "home", "easiest")}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.chip,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                    active === "FAVORITE" && {
                      backgroundColor: colors.pillActive,
                      borderColor: colors.pillActive,
                    },
                  ]}
                  onPress={() => {
                    setActive("FAVORITE");
                    setList(sortFavorite(recipes));
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.text },
                      active === "FAVORITE" && styles.chipTextActive,
                    ]}
                  >
                    {t(lang, "home", "favorite")}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.chip,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                    active === "RANDOM" && {
                      backgroundColor: colors.pillActive,
                      borderColor: colors.pillActive,
                    },
                  ]}
                  onPress={() => {
                    setActive("RANDOM");
                    setList(shuffle(recipes));
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.text },
                      active === "RANDOM" && styles.chipTextActive,
                    ]}
                  >
                    {t(lang, "home", "random")}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const rid = String(item._id || item.id || "");
          const stats = rid ? communityStats[rid] : undefined;

          const ratingVal =
            typeof stats?.avg === "number"
              ? stats.avg
              : typeof item.ratingAvg === "number"
              ? item.ratingAvg
              : item.rating || 0;

          const ratingCount =
            typeof stats?.count === "number"
              ? stats.count
              : typeof item.ratingCount === "number"
              ? item.ratingCount
              : undefined;

          return (
            <Pressable
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => setSelected(item)}
            >
              <Image source={{ uri: item.imgSrc }} style={styles.img} />
              <Text
                style={[styles.title, { color: colors.text }]}
                numberOfLines={2}
              >
                {getRecipeTitle(item, lang)}
              </Text>

              {/* ⭐ hvězdy + 4.3 (12) z communityStats */}
              <StarRatingDisplay value={ratingVal} count={ratingCount} />

              <Text style={[styles.meta, { color: colors.secondaryText }]}>
                <Text style={[styles.meta, { color: colors.secondaryText }]}>
                  {t(lang, "home", "difficulty")}:{" "}
                  {translateDifficulty(lang, item.difficulty)}
                </Text>
              </Text>
              <Text style={[styles.meta, { color: colors.secondaryText }]}>
                {" "}
                {t(lang, "home", "time")}: {item.time} ⏱️
              </Text>
            </Pressable>
          );
        }}
      />
      {/* Modal s náhledem receptu */}
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
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                  selectedIsSaved && {
                    backgroundColor: colors.pillActive,
                    borderColor: colors.pillActive,
                  },
                ]}
                onPress={() => toggleSaveOfficial(selected)}
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

              {ingredients.length ? (
                <>
                  <Text style={[styles.section, { color: colors.pillActive }]}>
                    {t(lang, "home", "ingredients")}
                  </Text>
                  {ingredients.map((ing, i) => (
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
                        onPress={() => addIngredientToShopping(ing)}
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
                  if (!selected) return;

                  const rid = String(
                    (selected as any)._id || (selected as any).id || ""
                  );
                  if (!rid) return;

                  // stejné jako na webu – najdeme community kopii
                  const stats =
                    communityStats && rid in communityStats
                      ? communityStats[rid]
                      : undefined;

                  router.push({
                    pathname: "/recipe/[id]",
                    params: {
                      id: rid,
                      recipe: JSON.stringify(selected),
                      // mobilní ekvivalent state.communityRecipeId z Home.jsx
                      communityRecipeId: stats?.id
                        ? String(stats.id)
                        : undefined,
                    },
                  });

                  setSelected(null);
                }}
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
                  {" "}
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
const styles = StyleSheet.create({
  container: { flex: 1 }, // ← odstraněno bílé pozadí
  card: {
    flex: 1,
    backgroundColor: "#191919ff",
    borderColor: "#151515ff",
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
  title: { fontSize: 14, fontWeight: "700", color: "#d0d0d0ff" },
  meta: { fontSize: 12, opacity: 0.7, color: "#d6d6d6ff" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#211d1dff",
  },
  err: { color: "#c00", fontWeight: "700", textAlign: "center" },

  modalOverlay: {
    flex: 1,

    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#212121ff",
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
  },
  primaryBtn: {
    backgroundColor: "#570303ff",
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
    borderColor: "#ccc",
    backgroundColor: "#434343ff",
  },
  secondaryBtnText: { color: "#a8a3a3ff", fontWeight: "700" },

  chip: {
    paddingHorizontal: 8,
    paddingVertical: 16,
    flex: 1,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#000000ff",
    backgroundColor: "#1a1919ff",
    borderBottomWidth: 0,
  },

  chipActive: {
    backgroundColor: "#660202ff",
    borderColor: "#570303ff",
  },
  chipText: {
    fontWeight: "700",
    color: "#d0d0d0",
    letterSpacing: 0.3,
    fontSize: 13, // menší text
    textAlign: "center", // zarovnání doprostřed
  },

  chipTextActive: {
    color: "#ffffff",
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 4,
  },

  saveFloatingBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 50,
    backgroundColor: "#222",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#000000ff",
  },
  saveFloatingBtnActive: {
    backgroundColor: "#5f0000ff",
    borderColor: "#5f0000ff",
  },
  saveFloatingBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  ratingStars: {
    fontSize: 12,
    color: "#ffd54f",
  },
  ratingValue: {
    fontSize: 11,
    color: "#ccc",
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginVertical: 2,
    borderBottomWidth: 1,
    borderColor: "#363636ff",
    padding: 5,
  },
  ingredientAddBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#444",
    backgroundColor: "#171111ff",
  },
});
