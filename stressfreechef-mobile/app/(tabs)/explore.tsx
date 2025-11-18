// app/(tabs)/explore.tsx
import { useEffect, useRef, useState } from "react";
import { useScrollToTop } from "@react-navigation/native";
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
  if (!r) return { url: PLACEHOLDER_IMG };
  const url =
    r.image?.url ||
    r.imgSrc ||
    findFirstImageStepSrc(r.steps || []) ||
    findAnyStepSrc(r.steps || []) ||
    PLACEHOLDER_IMG;
  return { url };
}

function StarRatingDisplay({
  value,
  count,
}: {
  value: number;
  count?: number;
}) {
  const val = Math.max(0, Math.min(5, value || 0));
  const full = Math.round(val);
  const stars = Array.from({ length: 5 }, (_, i) =>
    i < full ? "★" : "☆"
  ).join("");

  return (
    <View style={styles.ratingRow}>
      <Text style={styles.ratingStars}>{stars}</Text>
      <Text style={styles.ratingValue}>
        {val.toFixed(1)}
        {typeof count === "number" && count > 0 ? ` (${count})` : ""}
      </Text>
    </View>
  );
}

export default function ExploreScreen() {
  const [items, setItems] = useState<CommunityRecipe[]>([]);
  const [displayList, setDisplayList] = useState<CommunityRecipe[]>([]);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

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

  const listRef = useRef<FlatList<CommunityRecipe>>(null);
  useScrollToTop(listRef);

  // ===== debounce search =====
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // ===== načtení uložených community recipes (favorites / saved) =====
  useEffect(() => {
    if (!API_BASE) return;

    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          setFavoriteIds([]);
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
        setFavoriteIds(ids);
      } catch (e: any) {
        console.warn(
          "Failed to load saved community recipes:",
          e?.message || String(e)
        );
      }
    })();
  }, []);

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
        setItems(arr);
        setTotal(Number(data?.total) || arr.length);
        setPages(Number(data?.pages) || 1);
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
    let base: CommunityRecipe[] = items;
    if (active === "EASIEST") base = sortEasiest(items);
    else if (active === "FAVORITE") base = sortFavorite(items);
    else if (active === "RANDOM") base = shuffle(items);
    else base = sortNewest(items);
    setDisplayList(base);
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

    setSwipeDeck(shuffle(candidates));
    setSwipeIndex(0);
  }, [items, favoriteIds]);

  const canPrev = page > 1;
  const canNext = page < pages;

  if (!API_BASE) {
    return (
      <View style={styles.center}>
        <Text style={styles.errText}>Missing EXPO_PUBLIC_API_BASE in .env</Text>
      </View>
    );
  }

  // ===== Uložení do favorites (saved-community-recipes) =====
  async function handleSaveFavorite(
    recipe: CommunityRecipe | null | undefined
  ) {
    if (!recipe) return;
    const id = String(recipe._id || recipe.id || "");
    if (!id) return;

    // už uložený? nic nedělej
    if (favoriteIds.includes(id)) return;

    try {
      const token = await getToken();
      if (!token) {
        Alert.alert("Login required", "Log in to save recipes.");
        return;
      }

      await fetchJSON(`${API_BASE}/api/saved-community-recipes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipeId: id }),
      });

      // úspěch → přidej ID do seznamu uložených
      setFavoriteIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    } catch (e: any) {
      console.warn("Saving recipe failed:", e?.message || String(e));
      Alert.alert("Saving failed", e?.message || "Could not save recipe.");
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
    const { url } = getCover(item);
    const ratingVal =
      typeof item.ratingAvg === "number" ? item.ratingAvg : item.rating || 0;

    return (
      <Pressable
        style={styles.card}
        onPress={() => {
          const cover = getCover(item);
          setSelected({ ...item, imgSrc: cover.url });
        }}
      >
        <Image source={{ uri: url }} style={styles.cardImg} />
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title || "Untitled"}
        </Text>
        <StarRatingDisplay
          value={ratingVal}
          count={item.ratingCount ?? undefined}
        />
        <Text style={styles.cardMeta}>
          Difficulty: {item.difficulty || "—"}
        </Text>
        <Text style={styles.cardMeta}>Time: {item.time || "—"} ⏱️</Text>
      </Pressable>
    );
  };

  const noCards = swipeDeck.length === 0;
  const allSwiped = swipeDeck.length > 0 && swipeIndex >= swipeDeck.length;

  return (
    <View style={styles.screen}>
      {/* 🔝 Přepínač módů – vždy viditelný */}
      <View style={styles.headerWrap}>
        <View style={styles.viewModeRow}>
          <Pressable
            style={[
              styles.viewModeBtn,
              viewMode === "GRID" && styles.viewModeBtnActive,
            ]}
            onPress={() => setViewMode("GRID")}
          >
            <Text
              style={[
                styles.viewModeText,
                viewMode === "GRID" && styles.viewModeTextActive,
              ]}
            >
              GRID
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.viewModeBtn,
              viewMode === "SWIPE" && styles.viewModeBtnActive,
            ]}
            onPress={() => {
              setViewMode("SWIPE");
              // při přepnutí do SWIPE už deck máme připravený z useEffectu
            }}
          >
            <Text
              style={[
                styles.viewModeText,
                viewMode === "SWIPE" && styles.viewModeTextActive,
              ]}
            >
              SWIPE
            </Text>
          </Pressable>
          <Text style={styles.screenTitle}>EXPLORE RECIPES</Text>
        </View>

        {/* GRID header – nadpis, search, filtry (v SWIPE módu skryté) */}
        {viewMode === "GRID" && (
          <>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search recipes…"
                placeholderTextColor="#777"
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
                <Text style={styles.loadingText}>Loading recipes…</Text>
              </View>
            ) : null}

            {!loading && !err && items.length === 0 ? (
              <Text style={styles.emptyText}>
                No results found. Try a different keyword.
              </Text>
            ) : null}

            <View style={styles.chipsRow}>
              <Pressable
                style={[styles.chip, active === "EASIEST" && styles.chipActive]}
                onPress={() => setActive("EASIEST")}
              >
                <Text
                  style={[
                    styles.chipText,
                    active === "EASIEST" && styles.chipTextActive,
                  ]}
                >
                  EASIEST
                </Text>
              </Pressable>
              <Pressable
                style={[styles.chip, active === "NEWEST" && styles.chipActive]}
                onPress={() => setActive("NEWEST")}
              >
                <Text
                  style={[
                    styles.chipText,
                    active === "NEWEST" && styles.chipTextActive,
                  ]}
                >
                  NEWEST
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.chip,
                  active === "FAVORITE" && styles.chipActive,
                ]}
                onPress={() => setActive("FAVORITE")}
              >
                <Text
                  style={[
                    styles.chipText,
                    active === "FAVORITE" && styles.chipTextActive,
                  ]}
                >
                  FAVORITE
                </Text>
              </Pressable>
              <Pressable
                style={[styles.chip, active === "RANDOM" && styles.chipActive]}
                onPress={() => setActive("RANDOM")}
              >
                <Text
                  style={[
                    styles.chipText,
                    active === "RANDOM" && styles.chipTextActive,
                  ]}
                >
                  RANDOM
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      {/* Tělo – GRID nebo SWIPE */}
      {viewMode === "GRID" ? (
        loading && items.length === 0 ? (
          <View style={styles.center}>
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
            ListFooterComponent={
              pages > 1 || total > limit ? (
                <View style={styles.pagination}>
                  <Pressable
                    style={[styles.pageBtn, !canPrev && styles.pageBtnDisabled]}
                    disabled={!canPrev}
                    onPress={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <Text style={styles.pageBtnText}>◀ Previous</Text>
                  </Pressable>
                  <Text style={styles.pageInfo}>
                    Page {page} / {pages} · {total} results
                  </Text>
                  <Pressable
                    style={[styles.pageBtn, !canNext && styles.pageBtnDisabled]}
                    disabled={!canNext}
                    onPress={() => setPage((p) => Math.min(pages, p + 1))}
                  >
                    <Text style={styles.pageBtnText}>Next ▶</Text>
                  </Pressable>
                </View>
              ) : null
            }
          />
        )
      ) : (
        <View style={styles.swipeContainer}>
          {noCards ? (
            <Text style={styles.emptyText}>No recipes to swipe.</Text>
          ) : allSwiped ? (
            <Text style={styles.emptyText}>
              No more new recipes to swipe. 🎉
            </Text>
          ) : (
            <Swiper
              cards={swipeDeck}
              cardIndex={swipeIndex}
              backgroundColor="transparent"
              stackSize={3}
              infinite={false}
              verticalSwipe={false}
              onSwiped={(index) => setSwipeIndex(index + 1)}
              onSwipedRight={async (index) => {
                const card = swipeDeck[index];
                await handleSaveFavorite(card);
              }}
              renderCard={(card) => {
                if (!card) return null;
                const { url } = getCover(card);
                const ratingVal =
                  typeof card.ratingAvg === "number"
                    ? card.ratingAvg
                    : card.rating || 0;
                const id = String(card._id || card.id || "");
                const isFav = id && favoriteIds.includes(id);

                return (
                  <View style={styles.swipeCard}>
                    <ScrollView contentContainerStyle={styles.swipeCardContent}>
                      <Image source={{ uri: url }} style={styles.swipeImg} />
                      <Text style={styles.swipeTitle}>{card.title}</Text>

                      <StarRatingDisplay
                        value={ratingVal}
                        count={card.ratingCount ?? undefined}
                      />

                      <Text style={styles.swipeMeta}>
                        Difficulty: {card.difficulty || "—"}
                      </Text>
                      <Text style={styles.swipeMeta}>
                        Time: {card.time || "—"} ⏱️
                      </Text>

                      {card.ingredients?.length ? (
                        <>
                          <Text style={styles.section}>Ingredients</Text>
                          {card.ingredients.map((ing, i) => (
                            <Text key={i} style={styles.ingredient}>
                              • {ing}
                            </Text>
                          ))}
                        </>
                      ) : null}

                      {isFav ? (
                        <Text style={styles.savedLabel}>
                          Saved to favorites
                        </Text>
                      ) : null}

                      <Pressable
                        style={styles.primaryBtn}
                        onPress={() => openRecipe(card)}
                      >
                        <Text style={styles.primaryBtnText}>GET STARTED</Text>
                      </Pressable>
                    </ScrollView>

                    <View style={styles.swipeActionsRow}>
                      <Pressable
                        style={[styles.swipeActionBtn, styles.swipeActionSkip]}
                        onPress={() =>
                          setSwipeIndex((i) =>
                            i + 1 < swipeDeck.length ? i + 1 : i
                          )
                        }
                      >
                        <Text style={styles.swipeActionText}>Skip</Text>
                      </Pressable>

                      <Pressable
                        style={[styles.swipeActionBtn, styles.swipeActionSave]}
                        onPress={async () => {
                          await handleSaveFavorite(card);
                          setSwipeIndex((i) =>
                            i + 1 < swipeDeck.length ? i + 1 : i
                          );
                        }}
                      >
                        <Text style={styles.swipeActionText}>Save ❤️</Text>
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
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
              <Image
                source={{ uri: getCover(selected).url }}
                style={styles.modalImg}
              />
              <Text style={styles.modalTitle}>{selected?.title}</Text>
              <StarRatingDisplay
                value={
                  typeof selected?.ratingAvg === "number"
                    ? selected.ratingAvg
                    : selected?.rating || 0
                }
                count={selected?.ratingCount}
              />
              <Text style={styles.modalMeta}>
                Difficulty: {selected?.difficulty || "—"}
              </Text>
              <Text style={styles.modalMeta}>
                Time: {selected?.time || "—"} ⏱️
              </Text>

              {selected?.ingredients?.length ? (
                <>
                  <Text style={styles.section}>Ingredients</Text>
                  {selected.ingredients.map((ing, i) => (
                    <Text key={i} style={styles.ingredient}>
                      • {ing}
                    </Text>
                  ))}
                </>
              ) : null}

              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  openRecipe(selected);
                  setSelected(null);
                }}
              >
                <Text style={styles.primaryBtnText}>GET STARTED</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setSelected(null)}
              >
                <Text style={styles.secondaryBtnText}>Close</Text>
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
    gap: 8,
    justifyContent: "flex-start",
  },
  viewModeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
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
    color: "#111",
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
  pagination: {
    marginTop: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#333",
    alignItems: "center",
    gap: 8,
  },
  pageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#555",
    marginHorizontal: 4,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    color: "#eee",
    fontSize: 12,
  },
  pageInfo: {
    color: "#ccc",
    fontSize: 12,
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
});
