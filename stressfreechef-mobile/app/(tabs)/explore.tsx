// app/(tabs)/explore.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { useScrollToTop, useFocusEffect } from "@react-navigation/native";
import { Video, ResizeMode } from "expo-av";
import { MaterialIcons } from "@expo/vector-icons";
import { t, Lang, LANG_KEY } from "../../i18n/strings";
import { useTheme } from "../../theme/ThemeContext";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  TextInput,
  Image,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import Swiper from "react-native-deck-swiper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE, fetchJSON } from "../../lib/api";
import { router } from "expo-router";

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>["name"];

type Step = {
  type: "image" | "video" | "text";
  src?: string;
  description?: string;
};

type CommunityRecipe = {
  _id?: string;
  id?: string;
  title: string;
  difficulty?: string;
  time?: string;
  imgSrc?: string;
  image?: {
    url?: string;
    format?: string;
  };
  ingredients?: string[];
  steps?: Step[];
  rating?: number;
  ratingAvg?: number;
  ratingCount?: number;
  createdAt?: string;
};

type ViewMode = "GRID" | "SWIPE";

const PLACEHOLDER_IMG = "https://i.imgur.com/CZaFjz2.png";
const difficultyOrder = ["Beginner", "Intermediate", "Hard"];

// ===== Helpers =====
const TOKEN_KEY = "token";

async function getToken() {
  try {
    const t = await AsyncStorage.getItem(TOKEN_KEY);
    return t || "";
  } catch {
    return "";
  }
}

async function addIngredientToShopping(ingredient: string, lang: Lang) {
  const trimmed = ingredient.trim();
  if (!trimmed) return;

  try {
    const token = await getToken();

    // ⭐ Guest mód – uložíme do AsyncStorage
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

    // ⭐ Přihlášený user → backend POST
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
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    Alert.alert(
      lang === "cs" ? "Přidáno" : "Added",
      lang === "cs"
        ? `"${trimmed}" bylo přidáno do nákupního seznamu.`
        : `"${trimmed}" was added to your shopping list.`
    );
  } catch (e: any) {
    Alert.alert("Failed to add", e?.message || String(e));
  }
}

function findFirstImageStepSrc(steps: Step[] = []) {
  if (!Array.isArray(steps)) return "";
  const s = steps.find((x) => x?.type === "image" && x?.src);
  return s?.src || "";
}

function findAnyStepSrc(steps: Step[] = []) {
  if (!Array.isArray(steps)) return "";
  const s = steps.find((x) => x?.src);
  return s?.src || "";
}

function isVideo(url = "") {
  return /(\.mp4|\.webm|\.mov|\.m4v)(\?|#|$)/i.test(url);
}

function getCover(r: CommunityRecipe | null | undefined) {
  if (!r) return { url: PLACEHOLDER_IMG, isVideo: false };

  const url =
    r.image?.url ||
    r.imgSrc ||
    findFirstImageStepSrc(r.steps || []) ||
    findAnyStepSrc(r.steps || []) ||
    PLACEHOLDER_IMG;

  return { url, isVideo: isVideo(url) };
}

function StarRatingDisplay({
  value,
  count,
  size = 16,
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

          let icon: MaterialIconName = "star-border"; // ✅ správný typ

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

export default function ExploreScreen() {
  const { colors } = useTheme(); // ← theme barvy
  const [items, setItems] = useState<CommunityRecipe[]>([]);
  const [displayList, setDisplayList] = useState<CommunityRecipe[]>([]);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const limit = 12; // nemusí být useState
  const [hasMore, setHasMore] = useState(true);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [selected, setSelected] = useState<CommunityRecipe | null>(null);

  const [active, setActive] = useState<
    "EASIEST" | "NEWEST" | "FAVORITE" | "RANDOM"
  >("NEWEST");

  const [viewMode, setViewMode] = useState<ViewMode>("GRID");
  const [swipeDeck, setSwipeDeck] = useState<CommunityRecipe[]>([]);
  const [swipeIndex, setSwipeIndex] = useState(0);

  // IDs receptů, které už mám uložené v backendu (savedCommunityRecipes)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(LANG_KEY);
      if (stored === "cs" || stored === "en") setLang(stored);
    })();
  }, []);

  function translateDifficulty(lang: Lang, diff: string) {
    if (lang === "cs") {
      if (diff === "Beginner") return "Začátečník";
      if (diff === "Intermediate") return "Střední";
      if (diff === "Hard") return "Pokročilý";
    }
    return diff;
  }

  const listRef = useRef<FlatList<CommunityRecipe>>(null);
  useScrollToTop(listRef);

  // ===== debounce search =====
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
      setHasMore(true); // nový search = můžeme znovu načítat další stránky
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // ===== načtení uložených community recipes (favorites / saved) =====
  useFocusEffect(
    useCallback(() => {
      if (!API_BASE) return;

      let isActive = true;

      (async () => {
        try {
          const token = await getToken();
          if (!token) {
            if (isActive) setFavoriteIds([]);
            return;
          }

          const saved = await fetchJSON<CommunityRecipe[]>(
            `${API_BASE}/api/saved-community-recipes`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          const ids = Array.isArray(saved)
            ? saved
                .map((r) => String(r._id || (r as any).id || ""))
                .filter(Boolean)
            : [];

          if (isActive) setFavoriteIds(ids);
        } catch (e: any) {
          if (isActive) {
            console.warn(
              "Failed to load saved community recipes:",
              e?.message || String(e)
            );
          }
        }
      })();

      // cleanup – když obrazovka ztratí fokus
      return () => {
        isActive = false;
      };
    }, [])
  );

  // ===== fetch community recipes =====
  useEffect(() => {
    if (!API_BASE) return;

    let aborted = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        if (debouncedQ) params.set("q", debouncedQ);

        const url = `${API_BASE}/api/community-recipes?${params.toString()}`;

        const data = await fetchJSON<{
          items?: CommunityRecipe[];
          total?: number;
          pages?: number;
          page?: number;
        }>(url, { headers: { Accept: "application/json" } });

        if (aborted) return;

        const arr = Array.isArray(data?.items) ? data!.items! : [];

        setItems((prev) => (page === 1 ? arr : [...prev, ...arr]));

        // pokud přišlo méně než limit, další stránka už není
        setHasMore(arr.length === limit);
      } catch (e: any) {
        if (!aborted) {
          setErr(e?.message || "Failed to load community recipes.");
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    })();

    return () => {
      aborted = true;
    };
  }, [debouncedQ, page]);

  // ===== sort pomocné funkce =====
  function sortEasiest(src: CommunityRecipe[]) {
    return src
      .slice()
      .sort(
        (a, b) =>
          difficultyOrder.indexOf(a.difficulty || "") -
          difficultyOrder.indexOf(b.difficulty || "")
      );
  }

  function sortNewest(src: CommunityRecipe[]) {
    return src
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      );
  }

  function sortFavorite(src: CommunityRecipe[]) {
    return src
      .slice()
      .sort(
        (a, b) =>
          (b.ratingAvg ?? b.rating ?? 0) - (a.ratingAvg ?? a.rating ?? 0)
      );
  }

  function shuffle(src: CommunityRecipe[]) {
    const arr = src.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ===== GRID: přepočet displayList při změně items/filtru =====
  useEffect(() => {
    if (active === "EASIEST") setDisplayList(sortEasiest(items));
    else if (active === "FAVORITE") setDisplayList(sortFavorite(items));
    else if (active === "RANDOM") setDisplayList(shuffle(items));
    else setDisplayList(sortNewest(items));
  }, [items, active]);

  // ===== SWIPE: přepočet decku podle items + favoriteIds =====

  useEffect(() => {
    const idsSet = new Set(favoriteIds);
    const candidates = items.filter((r) => {
      const id = String(r._id || r.id || "");
      if (!id) return true;
      // zobrazuj jen recepty, které NEMÁM v savedCommunityRecipes
      return !idsSet.has(id);
    });

    setSwipeDeck(candidates);

    // když se lista zmenší (třeba kvůli save / novému fetchi),
    // a index by byl mimo rozsah, stáhneme ho na poslední kartu
    setSwipeIndex((idx) =>
      idx >= candidates.length
        ? candidates.length > 0
          ? candidates.length - 1
          : 0
        : idx
    );
  }, [items, favoriteIds]);

  if (!API_BASE) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errText, { color: colors.danger }]}>
          Missing EXPO_PUBLIC_API_BASE in .env
        </Text>
      </View>
    );
  }

  // ===== Toggle uložení do favorites (save / unsave) =====
  async function handleSaveFavorite(
    recipe: CommunityRecipe | null | undefined
  ) {
    if (!recipe) return;
    const id = String(recipe._id || recipe.id || "");
    if (!id) return;

    try {
      const token = await getToken();
      if (!token) {
        Alert.alert(
          t(lang, "home", "loginRequiredTitle"),
          t(lang, "home", "loginRequiredMsg")
        );
        return;
      }

      const alreadyFav = favoriteIds.includes(id);

      if (alreadyFav) {
        // UNSAVE – musíme použít obyč fetch (204 No Content)
        const res = await fetch(
          `${API_BASE}/api/saved-community-recipes/${id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!res.ok && res.status !== 204) {
          console.warn("Failed to unsave recipe", res.status);
        }

        setFavoriteIds((prev) => prev.filter((x) => x !== id));
        return;
      }

      // SAVE
      await fetchJSON(`${API_BASE}/api/saved-community-recipes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipeId: id }),
      });

      setFavoriteIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    } catch (e: any) {
      console.warn("Saving/unsaving recipe failed:", e?.message || String(e));
      Alert.alert(t(lang, "home", "addFailedTitle"), e?.message || String(e));
    }
  }

  function openRecipe(recipe: CommunityRecipe | null | undefined) {
    if (!recipe) return;
    const rid = String(recipe._id || recipe.id || "");
    if (!rid) return;

    router.push({
      pathname: "/recipe/[id]",
      params: {
        id: rid,
        recipe: JSON.stringify(recipe),
      },
    });
  }

  const renderItem = ({ item }: { item: CommunityRecipe }) => {
    const cover = getCover(item);
    const ratingVal =
      typeof item.ratingAvg === "number" ? item.ratingAvg : item.rating || 0;

    return (
      <Pressable
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        onPress={() => {
          setSelected(item); // modal si vezme cover přes getCover(selected)
        }}
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

        <Text
          style={[styles.cardTitle, { color: colors.text }]}
          numberOfLines={2}
        >
          {item.title || "Untitled"}
        </Text>
        <StarRatingDisplay
          value={ratingVal}
          count={item.ratingCount ?? undefined}
        />
        <Text style={[styles.cardMeta, { color: colors.secondaryText }]}>
          {t(lang, "home", "difficulty")}:{" "}
          {translateDifficulty(lang, item.difficulty || "—")}
        </Text>
        <Text style={[styles.cardMeta, { color: colors.secondaryText }]}>
          {" "}
          {t(lang, "home", "time")}: {item.time || "—"} ⏱️
        </Text>
      </Pressable>
    );
  };

  const noCards = swipeDeck.length === 0;
  const allSwiped = swipeDeck.length > 0 && swipeIndex >= swipeDeck.length;

  // „opravdu“ jsme na konci = žádné karty + už není co načítat
  const isDeckExhausted = allSwiped && !loading && !hasMore;

  const selectedId = selected ? String(selected._id || selected.id || "") : "";
  const selectedIsSaved = !!(selectedId && favoriteIds.includes(selectedId));
  const selectedCover = selected ? getCover(selected) : null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* 🔝 Přepínač módů – vždy viditelný */}
      <View style={[styles.headerWrap, { backgroundColor: colors.background }]}>
        <View style={styles.viewModeRow}>
          <Pressable
            style={[
              styles.viewModeBtn,
              { borderColor: colors.border, backgroundColor: colors.card },
              viewMode === "GRID" && {
                backgroundColor: colors.pillActive,
                borderColor: colors.pillActive,
              },
            ]}
            onPress={() => setViewMode("GRID")}
          >
            <Text
              style={[
                styles.viewModeText,
                { color: colors.text },
                viewMode === "GRID" && styles.viewModeTextActive,
              ]}
            >
              {t(lang, "explore", "grid")}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.viewModeBtn,
              { borderColor: colors.border, backgroundColor: colors.card },
              viewMode === "SWIPE" && {
                backgroundColor: colors.pillActive,
                borderColor: colors.pillActive,
              },
            ]}
            onPress={() => {
              setViewMode("SWIPE");
              // při přepnutí do SWIPE už deck máme připravený z useEffectu
            }}
          >
            <Text
              style={[
                styles.viewModeText,
                { color: colors.text },
                viewMode === "SWIPE" && styles.viewModeTextActive,
              ]}
            >
              {t(lang, "explore", "swipe")}
            </Text>
          </Pressable>
          <Text style={[styles.screenTitle, { color: colors.text }]}>
            {" "}
            {t(lang, "explore", "title")}
          </Text>
        </View>

        {/* GRID header – nadpis, search, filtry (v SWIPE módu skryté) */}
        {viewMode === "GRID" && (
          <>
            <View style={styles.searchRow}>
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholderTextColor={colors.muted}
                placeholder={t(lang, "explore", "searchPlaceholder")}
                value={q}
                onChangeText={setQ}
                returnKeyType="search"
              />
            </View>

            {err ? (
              <Text style={styles.errText}>{err}</Text>
            ) : loading && items.length === 0 ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator />
                <Text style={[styles.loadingText, { color: colors.muted }]}>
                  {" "}
                  {t(lang, "explore", "loading")}
                </Text>
              </View>
            ) : null}

            {!loading && !err && items.length === 0 ? (
              <Text style={styles.emptyText}>
                {t(lang, "explore", "empty")}
              </Text>
            ) : null}

            <View style={styles.chipsRow}>
              <Pressable
                style={[
                  styles.chip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  active === "NEWEST" && {
                    backgroundColor: colors.pillActive,
                    borderColor: colors.pillActive,
                  },
                ]}
                onPress={() => setActive("NEWEST")}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: colors.text },
                    active === "NEWEST" && styles.chipTextActive,
                  ]}
                >
                  {t(lang, "explore", "newest")}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.chip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  active === "EASIEST" && {
                    backgroundColor: colors.pillActive,
                    borderColor: colors.pillActive,
                  },
                ]}
                onPress={() => setActive("EASIEST")}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: colors.text },
                    active === "EASIEST" && styles.chipTextActive,
                  ]}
                >
                  {t(lang, "explore", "easiest")}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.chip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  active === "FAVORITE" && {
                    backgroundColor: colors.pillActive,
                    borderColor: colors.pillActive,
                  },
                ]}
                onPress={() => setActive("FAVORITE")}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: colors.text },
                    active === "FAVORITE" && styles.chipTextActive,
                  ]}
                >
                  {t(lang, "explore", "favorite")}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.chip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  active === "RANDOM" && {
                    backgroundColor: colors.pillActive,
                    borderColor: colors.pillActive,
                  },
                ]}
                onPress={() => setActive("RANDOM")}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: colors.text },
                    active === "RANDOM" && styles.chipTextActive,
                  ]}
                >
                  {t(lang, "explore", "random")}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      {/* Tělo – GRID nebo SWIPE */}
      {viewMode === "GRID" ? (
        loading && items.length === 0 ? (
          <View style={[styles.center, { backgroundColor: colors.background }]}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={displayList}
            keyExtractor={(r, idx) => String(r._id || r.id || idx)}
            numColumns={2}
            columnWrapperStyle={{ justifyContent: "space-between" }}
            contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
            keyboardShouldPersistTaps="handled"
            renderItem={renderItem}
            onEndReachedThreshold={0.5}
            onEndReached={() => {
              if (!loading && hasMore) {
                setPage((p) => p + 1);
              }
            }}
            ListFooterComponent={
              loading && items.length > 0 ? (
                <View style={styles.listFooter}>
                  <ActivityIndicator />
                  <Text style={[styles.loadingText, { color: colors.muted }]}>
                    {t(lang, "explore", "loadingMore")}
                  </Text>
                </View>
              ) : null
            }
          />
        )
      ) : (
        <View style={styles.swipeContainer}>
          {noCards ? (
            <Text style={styles.emptyText}>
              {t(lang, "explore", "noSwipe")}
            </Text>
          ) : isDeckExhausted ? (
            // opravdu jsme na konci, backend už nic dalšího neposílá
            <Text style={styles.emptyText}>
              {" "}
              {t(lang, "explore", "noMoreSwipe")}
            </Text>
          ) : allSwiped && loading && hasMore ? (
            // jsme na poslední kartě, ale zrovna se načítá další stránka → ukaž loader místo „no more“
            <View style={styles.center}>
              <ActivityIndicator />
              <Text style={[styles.loadingText, { color: colors.muted }]}>
                {" "}
                {t(lang, "explore", "loadingMoreSwipe")}
              </Text>
            </View>
          ) : (
            <Swiper
              cards={swipeDeck}
              cardIndex={swipeIndex}
              backgroundColor="transparent"
              stackSize={3}
              infinite={false}
              verticalSwipe={false}
              onSwiped={(index) => {
                const next = index + 1;
                setSwipeIndex(next);

                const remaining = swipeDeck.length - next;
                if (remaining <= 3 && hasMore && !loading) {
                  setPage((p) => p + 1);
                }
              }}
              onSwipedRight={async (index) => {
                const card = swipeDeck[index];
                await handleSaveFavorite(card);
              }}
              renderCard={(card) => {
                if (!card) return null; // ⬅️ přidat jako první řádek

                const cover = getCover(card);
                const ratingVal =
                  typeof card.ratingAvg === "number"
                    ? card.ratingAvg
                    : card.rating || 0;
                const id = String(card._id || card.id || "");
                const isFav = id && favoriteIds.includes(id);

                return (
                  <View
                    style={[
                      styles.swipeCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <ScrollView contentContainerStyle={styles.swipeCardContent}>
                      {cover.isVideo ? (
                        <Video
                          source={{ uri: cover.url }}
                          style={styles.swipeImg}
                          resizeMode={ResizeMode.CONTAIN}
                          isLooping
                          shouldPlay
                          isMuted
                        />
                      ) : (
                        <Image
                          source={{ uri: cover.url }}
                          style={styles.swipeImg}
                        />
                      )}
                      <Text style={[styles.swipeTitle, { color: colors.text }]}>
                        {card.title}
                      </Text>
                      <StarRatingDisplay
                        value={ratingVal}
                        count={card.ratingCount ?? undefined}
                      />
                      <Text
                        style={[
                          styles.swipeMeta,
                          { color: colors.secondaryText },
                        ]}
                      >
                        {t(lang, "home", "difficulty")}:{" "}
                        {translateDifficulty(lang, card.difficulty || "—")}
                      </Text>
                      <Text
                        style={[
                          styles.swipeMeta,
                          { color: colors.secondaryText },
                        ]}
                      >
                        {t(lang, "home", "time")}: {card.time || "—"} ⏱️
                      </Text>
                      {card.ingredients?.length ? (
                        <>
                          <Text
                            style={[
                              styles.section,
                              { color: colors.pillActive },
                            ]}
                          >
                            {" "}
                            {t(lang, "explore", "ingredients")}
                          </Text>
                          {card.ingredients.map((ing, i) => (
                            <Text
                              key={i}
                              style={[
                                styles.ingredient,
                                { color: colors.text },
                              ]}
                            >
                              • {ing}
                            </Text>
                          ))}
                        </>
                      ) : null}

                      <Pressable
                        style={[
                          styles.primaryBtn,
                          { backgroundColor: colors.pillActive },
                        ]}
                        onPress={() => openRecipe(card)}
                      >
                        <Text style={styles.primaryBtnText}>
                          {t(lang, "explore", "getStarted")}
                        </Text>
                      </Pressable>
                    </ScrollView>

                    <View style={styles.swipeActionsRow}>
                      <Pressable
                        style={[
                          styles.swipeActionBtn,
                          {
                            backgroundColor: colors.border,
                            borderColor: colors.border,
                          },
                        ]}
                        onPress={() => {
                          setSwipeIndex((i) => {
                            const next = i + 1 < swipeDeck.length ? i + 1 : i;
                            const remaining = swipeDeck.length - next;
                            if (remaining <= 3 && hasMore && !loading) {
                              setPage((p) => p + 1);
                            }
                            return next;
                          });
                        }}
                      >
                        <Text
                          style={[
                            styles.swipeActionText,
                            { color: colors.text },
                          ]}
                        >
                          {" "}
                          {t(lang, "explore", "skip")}
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.swipeActionBtn,
                          { backgroundColor: colors.pillActive },
                        ]}
                        onPress={async () => {
                          await handleSaveFavorite(card);
                          setSwipeIndex((i) => {
                            const next = i + 1 < swipeDeck.length ? i + 1 : i;
                            const remaining = swipeDeck.length - next;
                            if (remaining <= 3 && hasMore && !loading) {
                              setPage((p) => p + 1);
                            }
                            return next;
                          });
                        }}
                      >
                        <Text
                          style={[
                            styles.swipeActionText,
                            { color: colors.text },
                          ]}
                        >
                          {" "}
                          {t(lang, "explore", "save")}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      )}

      {/* Modal z GRID módu */}
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
                  styles.modalSaveBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  selectedIsSaved && {
                    backgroundColor: colors.pillActive,
                    borderColor: colors.pillActive,
                  },
                ]}
                onPress={() => handleSaveFavorite(selected)}
              >
                <Text style={[styles.modalSaveBtnText, { color: colors.text }]}>
                  {selectedIsSaved ? "Saved" : "Save"}
                </Text>
              </Pressable>
            )}
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
                  source={{ uri: selectedCover?.url || PLACEHOLDER_IMG }}
                  style={styles.modalImg}
                />
              )}

              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {selected?.title}
              </Text>
              <StarRatingDisplay
                value={
                  typeof selected?.ratingAvg === "number"
                    ? selected.ratingAvg
                    : selected?.rating || 0
                }
                count={selected?.ratingCount}
              />
              <Text style={[styles.modalMeta, { color: colors.secondaryText }]}>
                {t(lang, "home", "difficulty")}:{" "}
                {translateDifficulty(lang, selected?.difficulty || "—")}
              </Text>
              <Text style={[styles.modalMeta, { color: colors.secondaryText }]}>
                {t(lang, "home", "time")}: {selected?.time || "—"} ⏱️
              </Text>
              {selected?.ingredients?.length ? (
                <>
                  <Text style={[styles.section, { color: colors.pillActive }]}>
                    {" "}
                    {t(lang, "explore", "ingredients")}
                  </Text>
                  {selected.ingredients.map((ing, i) => (
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
                  openRecipe(selected);
                  setSelected(null);
                }}
              >
                <Text style={styles.primaryBtnText}>
                  {t(lang, "explore", "getStarted")}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.secondaryBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  },
                ]}
                onPress={() => setSelected(null)}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
                  {" "}
                  {t(lang, "explore", "close")}
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
  screen: {
    flex: 1,
    backgroundColor: "#0f0f0fff",
    paddingTop: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f0f0fff",
  },
  headerWrap: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: "#0f0f0fff",
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f5f5f5",
    textAlign: "right",
    paddingLeft: 30,
  },
  viewModeRow: {
    flexDirection: "row",

    justifyContent: "flex-start",
  },
  viewModeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,

    borderWidth: 1,
    borderColor: "#444",
  },
  viewModeBtnActive: {
    backgroundColor: "#f5f5f5",
    borderColor: "#f5f5f5",
  },
  viewModeText: {
    color: "#ccc",
    fontSize: 12,
    fontWeight: "600",
  },
  viewModeTextActive: {
    color: "#ffffffff",
  },
  searchRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    marginTop: 20,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#1f1f1fff",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#333",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  loadingText: {
    color: "#ddd",
  },
  errText: {
    color: "#ff6b6b",
    marginTop: 4,
  },
  emptyText: {
    color: "#aaa",
    marginTop: 12,
    textAlign: "center",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#444",
  },
  chipActive: {
    backgroundColor: "#b00020",
    borderColor: "#b00020",
  },
  chipText: {
    color: "#ccc",
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#fff",
  },
  card: {
    flex: 1,
    backgroundColor: "#191919ff",
    borderColor: "#151515ff",
    borderWidth: 2,
    padding: 10,
    gap: 4,
    borderRadius: 10,
    marginBottom: 10,
  },
  cardImg: {
    width: "100%",
    aspectRatio: 1.3,
    borderRadius: 10,
    backgroundColor: "#333",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f0f0f0",
  },
  cardMeta: {
    fontSize: 12,
    color: "#d6d6d6ff",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingStars: {
    fontSize: 12,
    color: "#ffd54f",
  },
  ratingValue: {
    fontSize: 11,
    color: "#ccc",
  },

  swipeContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  swipeCard: {
    flex: 0.8,
    backgroundColor: "#191919ff",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#303030",
    padding: 12,
  },
  swipeCardContent: {
    paddingBottom: 12,
    alignItems: "center",
  },
  swipeImg: {
    width: "100%",
    aspectRatio: 1.3,
    borderRadius: 12,
    backgroundColor: "#333",
  },
  swipeTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f5f5f5",
    marginTop: 10,
    textAlign: "center",
  },
  swipeMeta: {
    fontSize: 13,
    color: "#d6d6d6ff",
    marginTop: 2,
  },
  savedLabel: {
    marginTop: 6,
    fontSize: 12,
    color: "#8bc34a",
  },
  swipeActionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 16,
  },
  swipeActionBtn: {
    flex: 1,
    marginHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },
  swipeActionSkip: {
    backgroundColor: "#333",
  },
  swipeActionSave: {
    backgroundColor: "#b00020",
  },
  swipeActionText: {
    color: "#fff",
    fontWeight: "700",
  },
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
    position: "relative",
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
    color: "#f5f5f5",
  },
  modalMeta: {
    marginTop: 4,
    color: "#ddd",
    fontSize: 13,
  },
  section: {
    marginTop: 12,
    marginBottom: 4,
    fontWeight: "700",
    color: "#ffb3b3",
  },
  ingredient: {
    fontSize: 14,
    color: "#f5f5f5",
    marginBottom: 2,
  },
  primaryBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#b00020",
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  secondaryBtn: {
    marginTop: 8,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#555",
    alignItems: "center",
  },
  secondaryBtnText: {
    color: "#ddd",
  },
  modalSaveBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#333",
    borderWidth: 1,
    borderColor: "#555",
    zIndex: 999,
  },
  modalSaveBtnActive: {
    backgroundColor: "#b00020",
    borderColor: "#b00020",
  },
  modalSaveBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  listFooter: {
    paddingVertical: 12,
    alignItems: "center",
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  },
});
