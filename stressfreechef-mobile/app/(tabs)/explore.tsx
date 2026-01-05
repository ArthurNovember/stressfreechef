import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useScrollToTop, useFocusEffect } from "@react-navigation/native";
import { Video, ResizeMode } from "expo-av";
import { MaterialIcons } from "@expo/vector-icons";
import Swiper from "react-native-deck-swiper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

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

import { t, Lang, LANG_KEY } from "../../i18n/strings";
import { useTheme } from "../../theme/ThemeContext";
import { API_BASE, fetchJSON } from "../../lib/api";

/* =========================
   TYPES
========================= */

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
  image?: { url?: string; format?: string };
  ingredients?: string[];
  steps?: Step[];
  rating?: number;
  ratingAvg?: number;
  ratingCount?: number;
  createdAt?: string;
};

type ViewMode = "GRID" | "SWIPE";
type ActiveTab = "EASIEST" | "NEWEST" | "FAVORITE" | "RANDOM";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/* =========================
   CONSTS
========================= */

const PLACEHOLDER_IMG = "https://i.imgur.com/CZaFjz2.png";
const TOKEN_KEY = "token";
const GUEST_SHOPPING_KEY = "shopping_guest_items";

const difficultyOrder = ["Beginner", "Intermediate", "Hard"] as const;

/* =========================
   HELPERS 
========================= */

function getId(r: CommunityRecipe | null | undefined) {
  return String(r?._id || r?.id || "");
}

function isVideo(url = "") {
  return /(\.mp4|\.webm|\.mov|\.m4v)(\?|#|$)/i.test(url);
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

function activeToSort(active: ActiveTab) {
  if (active === "EASIEST") return "easiest";
  if (active === "FAVORITE") return "favorite";
  if (active === "RANDOM") return "random";
  return "newest";
}

function translateDifficulty(lang: Lang, diff: string) {
  if (lang === "cs") {
    if (diff === "Beginner") return "Začátečník";
    if (diff === "Intermediate") return "Pokročilý";
    if (diff === "Hard") return "Expert";
  }
  return diff;
}

function shuffle<T>(src: T[]) {
  const arr = src.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getRatingValue(r: CommunityRecipe) {
  return typeof r.ratingAvg === "number" ? r.ratingAvg : r.rating || 0;
}

/* =========================
   API 
========================= */

async function getToken(): Promise<string> {
  try {
    const t = await AsyncStorage.getItem(TOKEN_KEY);
    return t || "";
  } catch {
    return "";
  }
}

async function loadLang(): Promise<Lang> {
  try {
    const stored = await AsyncStorage.getItem(LANG_KEY);
    return stored === "cs" || stored === "en" ? stored : "en";
  } catch {
    return "en";
  }
}

async function loadFavoriteIds(): Promise<ActionResult<string[]>> {
  if (!API_BASE) return { ok: true, data: [] };

  const token = await getToken();
  if (!token) return { ok: true, data: [] };

  try {
    const saved = await fetchJSON<any>(
      `${API_BASE}/api/saved-community-recipes`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const arr = Array.isArray(saved)
      ? saved
      : Array.isArray(saved?.items)
      ? saved.items
      : [];

    const ids = arr.map((r: any) => getId(r)).filter(Boolean);

    return { ok: true, data: ids };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.message || "Failed to load saved community recipes.",
    };
  }
}

async function toggleSaveFavorite(
  lang: Lang,
  recipeId: string,
  currentlySaved: boolean
): Promise<ActionResult<{ nextSaved: boolean }>> {
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
    if (currentlySaved) {
      const res = await fetch(
        `${API_BASE}/api/saved-community-recipes/${recipeId}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok && res.status !== 204) {
        return { ok: false, error: `Failed to unsave (HTTP ${res.status})` };
      }

      return { ok: true, data: { nextSaved: false } };
    }

    await fetchJSON(`${API_BASE}/api/saved-community-recipes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipeId }),
    });

    return { ok: true, data: { nextSaved: true } };
  } catch (e: any) {
    Alert.alert(t(lang, "home", "addFailedTitle"), e?.message || String(e));
    return { ok: false, error: e?.message || "Failed to save/unsave." };
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
    Alert.alert("Failed to add", e?.message || String(e));
  }
}

/* =========================
   UI PARTS 
========================= */

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

export default function ExploreScreen() {
  const { colors } = useTheme();

  const [items, setItems] = useState<CommunityRecipe[]>([]);
  const [displayList, setDisplayList] = useState<CommunityRecipe[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [swipeDeck, setSwipeDeck] = useState<CommunityRecipe[]>([]);

  const [lang, setLang] = useState<Lang>("en");
  const [viewMode, setViewMode] = useState<ViewMode>("GRID");
  const [active, setActive] = useState<ActiveTab>("NEWEST");

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const limit = 12;
  const [hasMore, setHasMore] = useState(true);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [selected, setSelected] = useState<CommunityRecipe | null>(null);
  const [randomSeed, setRandomSeed] = useState(0);
  const justFocusedRef = useRef(false);

  const listRef = useRef<FlatList<CommunityRecipe>>(null);
  useScrollToTop(listRef);

  const swiperRef = useRef<Swiper<CommunityRecipe> | null>(null);

  /* =========================
   Effects
========================= */

  useEffect(() => {
    (async () => {
      const l = await loadLang();
      setLang(l);
    })();
  }, []);

  useEffect(() => {
    const tmr = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(tmr);
  }, [q]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      (async () => {
        const res = await loadFavoriteIds();
        if (!alive) return;

        if (res.ok) setFavoriteIds(res.data);
        else console.warn(res.error);
      })();

      return () => {
        alive = false;
      };
    }, [])
  );

  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    setErr(null);
  }, [active, debouncedQ]);

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

        if (active !== "RANDOM") params.set("sort", activeToSort(active));

        const url = `${API_BASE}/api/community-recipes?${params.toString()}`;

        const data = await fetchJSON<{
          items?: CommunityRecipe[];
          pages?: number;
          page?: number;
        }>(url, { headers: { Accept: "application/json" } });

        if (aborted) return;

        const arr = Array.isArray(data?.items) ? data.items : [];
        setItems((prev) => (page === 1 ? arr : [...prev, ...arr]));

        const nextHasMore =
          typeof data?.pages === "number" && typeof data?.page === "number"
            ? data.page < data.pages
            : arr.length === limit;

        setHasMore(nextHasMore);
      } catch (e: any) {
        if (!aborted) setErr(e?.message || "Failed to load community recipes.");
      } finally {
        if (!aborted) setLoading(false);
      }
    })();

    return () => {
      aborted = true;
    };
  }, [debouncedQ, page, active]);

  useEffect(() => {
    if (active === "RANDOM") setDisplayList(shuffle(items));
    else setDisplayList(items);
  }, [items, active, randomSeed]);

  useEffect(() => {
    const idsSet = new Set(favoriteIds);
    const candidates = items.filter((r) => {
      const id = getId(r);
      if (!id) return true;
      return !idsSet.has(id);
    });
    setSwipeDeck(candidates);
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

  /* =========================
     HANDLERS
  ========================= */

  async function handleToggleSave(recipe: CommunityRecipe | null | undefined) {
    if (!recipe) return;
    const id = getId(recipe);
    if (!id) return;

    const currentlySaved = favoriteIds.includes(id);
    const res = await toggleSaveFavorite(lang, id, currentlySaved);

    if (!res.ok) return;

    setFavoriteIds((prev) => {
      if (res.data.nextSaved) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function openRecipe(recipe: CommunityRecipe | null | undefined) {
    if (!recipe) return;
    const rid = getId(recipe);
    if (!rid) return;

    router.push({
      pathname: "/recipe/[id]",
      params: {
        id: rid,
        recipe: JSON.stringify(recipe),
        source: "explore",
      },
    });
  }

  function handleLoadMore() {
    if (justFocusedRef.current) return;
    if (!loading && hasMore) setPage((p) => p + 1);
  }

  /* =========================
     RENDER
  ========================= */

  const renderGridItem = ({ item }: { item: CommunityRecipe }) => {
    const cover = getCover(item);
    const ratingVal = getRatingValue(item);

    return (
      <Pressable
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
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
          {t(lang, "home", "time")}: {item.time || "—"} ⏱️
        </Text>
      </Pressable>
    );
  };

  const renderSwipeCard = (card: CommunityRecipe | null) => {
    if (!card) return null;

    const cover = getCover(card);
    const ratingVal = getRatingValue(card);

    return (
      <View
        style={[
          styles.swipeCard,
          { backgroundColor: colors.card, borderColor: colors.border },
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
            <Image source={{ uri: cover.url }} style={styles.swipeImg} />
          )}

          <Text style={[styles.swipeTitle, { color: colors.text }]}>
            {card.title}
          </Text>

          <StarRatingDisplay
            value={ratingVal}
            count={card.ratingCount ?? undefined}
          />

          <Text style={[styles.swipeMeta, { color: colors.secondaryText }]}>
            {t(lang, "home", "difficulty")}:{" "}
            {translateDifficulty(lang, card.difficulty || "—")}
          </Text>

          <Text style={[styles.swipeMeta, { color: colors.secondaryText }]}>
            {t(lang, "home", "time")}: {card.time || "—"} ⏱️
          </Text>

          <Pressable
            style={[styles.primaryBtn, { backgroundColor: colors.pillActive }]}
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
              { backgroundColor: colors.border, borderColor: colors.border },
            ]}
            onPress={() => swiperRef.current?.swipeLeft()}
          >
            <Text style={[styles.swipeActionText, { color: colors.text }]}>
              {t(lang, "explore", "skip")}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.swipeActionBtn,
              { backgroundColor: colors.pillActive },
            ]}
            onPress={() => swiperRef.current?.swipeRight()}
          >
            <Text style={[styles.swipeActionText, { color: colors.text }]}>
              {t(lang, "explore", "save")}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  /* =========================
     Modal/swipe
  ========================= */

  const swipeEmpty = swipeDeck.length === 0 && !loading && !hasMore;
  const swipeLoading = swipeDeck.length === 0 && (loading || hasMore);

  const selectedId = selected ? getId(selected) : "";
  const selectedIsSaved = !!(selectedId && favoriteIds.includes(selectedId));
  const selectedCover = selected ? getCover(selected) : null;

  /* =========================
     UI
  ========================= */

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
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
            onPress={() => setViewMode("SWIPE")}
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

          <Text
            style={[
              styles.screenTitle,
              { color: colors.text, fontFamily: "MetropolisBold" },
            ]}
          >
            {t(lang, "explore", "title")}
          </Text>
        </View>

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
                onPress={() => {
                  setActive("RANDOM");
                  setRandomSeed((s) => s + 1);
                }}
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
            renderItem={renderGridItem}
            onEndReachedThreshold={0.5}
            onEndReached={handleLoadMore}
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
          {swipeEmpty ? (
            <Text style={styles.emptyText}>
              {t(lang, "explore", "noMoreSwipe")}
            </Text>
          ) : swipeLoading ? (
            <View style={styles.center}>
              <ActivityIndicator />
              <Text style={[styles.loadingText, { color: colors.muted }]}>
                {t(lang, "explore", "loadingMoreSwipe")}
              </Text>
            </View>
          ) : (
            <Swiper
              ref={swiperRef as any}
              cards={swipeDeck}
              backgroundColor="transparent"
              stackSize={3}
              infinite={false}
              verticalSwipe={false}
              onSwiped={(index) => {
                const cardsLeft = swipeDeck.length - (index + 1);
                if (cardsLeft <= 3 && hasMore && !loading)
                  setPage((p) => p + 1);
              }}
              onSwipedRight={async (index) => {
                const card = swipeDeck[index];
                await handleToggleSave(card);
              }}
              renderCard={renderSwipeCard}
            />
          )}
        </View>
      )}

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
                onPress={() => handleToggleSave(selected)}
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
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
                onPress={() => setSelected(null)}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
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

/* =========================
   STYLES
========================= */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f0f0fff", paddingTop: 40 },
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

  viewModeRow: { flexDirection: "row", justifyContent: "flex-start" },

  viewModeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#444",
  },

  viewModeText: { color: "#ccc", fontSize: 12, fontWeight: "600" },
  viewModeTextActive: { color: "#ffffffff" },

  searchRow: { flexDirection: "row", gap: 8, marginBottom: 8, marginTop: 20 },

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
  loadingText: { color: "#ddd" },
  errText: { color: "#ff6b6b", marginTop: 4 },
  emptyText: { color: "#aaa", marginTop: 12, textAlign: "center" },

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
  chipText: { color: "#ccc", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#fff" },

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
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#f0f0f0" },
  cardMeta: { fontSize: 12, color: "#d6d6d6ff" },

  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingValue: { fontSize: 11, color: "#ccc" },

  listFooter: { paddingVertical: 12, alignItems: "center" },

  swipeContainer: { flex: 1, paddingHorizontal: 12, paddingBottom: 24 },
  swipeCard: {
    flex: 0.8,
    backgroundColor: "#191919ff",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#303030",
    padding: 12,
  },
  swipeCardContent: { paddingBottom: 12, alignItems: "center" },
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
  swipeMeta: { fontSize: 13, color: "#d6d6d6ff", marginTop: 2 },

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
  swipeActionText: { color: "#fff", fontWeight: "700" },

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
  modalMeta: { marginTop: 4, color: "#ddd", fontSize: 13 },

  section: {
    marginTop: 12,
    marginBottom: 4,
    fontWeight: "700",
    color: "#ffb3b3",
  },

  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: "#363636ff",
  },
  ingredient: {
    fontSize: 14,
    color: "#f5f5f5",
    marginBottom: 2,
    flex: 1,
    flexWrap: "wrap",
    marginRight: 8,
  },
  ingredientAddBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#171111ff",
    alignSelf: "flex-start",
  },

  primaryBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#b00020",
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },

  secondaryBtn: {
    marginTop: 8,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#555",
    alignItems: "center",
  },
  secondaryBtnText: { color: "#ddd" },

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
  modalSaveBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
