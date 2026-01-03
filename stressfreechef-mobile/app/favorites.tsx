// app/favorites.tsx

/* =========================
   IMPORTS
========================= */
import React, { useCallback, useMemo, useState, useEffect } from "react";
import { t, Lang, LANG_KEY } from "../i18n/strings";
import { useTheme } from "../theme/ThemeContext";
import { MaterialIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { API_BASE, fetchJSON } from "../lib/api";

/* =========================
   TYPES
========================= */
type ShopOption = {
  _id: string;
  name: string;
};

type FavoriteItem = {
  _id: string;
  text: string;
  shop: ShopOption[];
};

/* =========================
   CONSTS + STORAGE
========================= */
const BASE = API_BASE || "https://stressfreecheff-backend.onrender.com";
const TOKEN_KEY = "token";

async function getToken() {
  return (await AsyncStorage.getItem(TOKEN_KEY)) || "";
}

/* =========================
   HELPERS (pure)
========================= */
const isUnauthorizedError = (e: any) => {
  const msg = String(e?.message ?? e ?? "");
  return (
    /\b401\b/i.test(msg) ||
    /unauthor/i.test(msg) ||
    (/token/i.test(msg) && /invalid|expire|platn/i.test(msg))
  );
};

/* =========================
   SCREEN
========================= */
export default function FavoritesScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  /* ---------- base state ---------- */
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [shopOptions, setShopOptions] = useState<ShopOption[]>([]);

  // nový favorite
  const [newText, setNewText] = useState("");
  const [newFavoriteShopIds, setNewFavoriteShopIds] = useState<string[]>([]);
  const [savingFavorite, setSavingFavorite] = useState(false);

  // modal pro shopy konkrétního favorite
  const [editingFavoriteId, setEditingFavoriteId] = useState<string | null>(
    null
  );

  // globální manage shops
  const [manageShopsVisible, setManageShopsVisible] = useState(false);
  const [addingShopName, setAddingShopName] = useState("");
  const [addingShopBusy, setAddingShopBusy] = useState(false);

  // filtrování jako v shopping.tsx
  const [filterShopIds, setFilterShopIds] = useState<string[]>([]);

  // lang
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(LANG_KEY);
      if (stored === "cs" || stored === "en") setLang(stored);
    })();
  }, []);

  /* =========================
     HW back → zpět na shopping tab
  ========================= */
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.replace("/(tabs)/shopping");
        return true;
      };

      const sub = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress
      );
      return () => sub.remove();
    }, [router])
  );

  /* =========================
     LOAD favorites + shops
     (fix: závisí na lang, aby error text byl správně)
  ========================= */
  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      const token = await getToken();

      const [favoritesRes, shopsRes] = await Promise.all([
        fetchJSON<FavoriteItem[]>(`${BASE}/api/favorites`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetchJSON<ShopOption[]>(`${BASE}/api/shopping-list/shop-options`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setFavorites(Array.isArray(favoritesRes) ? favoritesRes : []);
      setShopOptions(Array.isArray(shopsRes) ? shopsRes : []);
    } catch (e: any) {
      if (isUnauthorizedError(e)) setErr(t(lang, "shopping", "sessionExpired"));
      else setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  /* =========================
     DERIVED
  ========================= */
  const processedFavorites = useMemo(() => {
    let res = [...favorites];

    if (filterShopIds.length > 0) {
      res = res.filter((item) => {
        if (!item.shop || item.shop.length === 0) {
          return filterShopIds.includes("No Shop");
        }
        const ids = item.shop.map((s) => String(s._id));
        return filterShopIds.some((f) => ids.includes(f));
      });
    }

    // nejnovější nahoře (pokud backend vrací podle vytvoření)
    return res.reverse();
  }, [favorites, filterShopIds]);

  const editingFavorite = useMemo(() => {
    if (!editingFavoriteId) return null;
    return favorites.find((f) => f._id === editingFavoriteId) || null;
  }, [editingFavoriteId, favorites]);

  const noShopActive = filterShopIds.includes("No Shop");

  /* =========================
     ACTIONS: Favorites
  ========================= */

  const updateFavorite = useCallback(
    async (id: string, updates: { shop?: string[] }) => {
      try {
        const token = await getToken();
        const res = await fetch(`${BASE}/api/favorites/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updates),
        });

        const updated: FavoriteItem[] = await res.json().catch(() => []);
        if (!res.ok)
          throw new Error((updated as any)?.error || `HTTP ${res.status}`);

        setFavorites(Array.isArray(updated) ? updated : []);
      } catch (e: any) {
        Alert.alert(
          t(lang, "shopping", "failedUpdateFavorites"),
          e?.message || String(e)
        );
      }
    },
    [lang]
  );

  const handleAddFavorite = useCallback(async () => {
    const trimmed = newText.trim();
    if (!trimmed) return;

    try {
      setSavingFavorite(true);
      const token = await getToken();
      if (!token) {
        Alert.alert(
          t(lang, "shopping", "loginRequiredFavoritesTitle"),
          t(lang, "shopping", "loginRequiredFavoritesMsg")
        );
        return;
      }

      const res = await fetch(`${BASE}/api/favorites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: trimmed, shop: newFavoriteShopIds }),
      });

      const updated: FavoriteItem[] = await res.json().catch(() => []);
      if (!res.ok)
        throw new Error((updated as any)?.error || `HTTP ${res.status}`);

      setFavorites(Array.isArray(updated) ? updated : []);
      setNewText("");
      setNewFavoriteShopIds([]);
    } catch (e: any) {
      Alert.alert(
        t(lang, "shopping", "failedAddFavorite"),
        e?.message || String(e)
      );
    } finally {
      setSavingFavorite(false);
    }
  }, [lang, newText, newFavoriteShopIds]);

  const addToShoppingList = useCallback(
    async (fav: FavoriteItem) => {
      try {
        const token = await getToken();
        if (!token) {
          Alert.alert(
            t(lang, "shopping", "loginRequiredFavoritesTitle"),
            t(lang, "shopping", "loginRequiredFavoritesMsg")
          );
          return;
        }

        const shopIds = Array.isArray(fav.shop)
          ? fav.shop.map((s) => s._id).filter(Boolean)
          : [];

        const res = await fetch(`${BASE}/api/shopping-list`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text: fav.text, shop: shopIds }),
        });

        const updatedList = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error((updatedList as any)?.error || `HTTP ${res.status}`);

        Alert.alert(
          t(lang, "favorites", "addedToShoppingTitle"),
          t(lang, "favorites", "addedToShoppingMsg")
        );
      } catch (e: any) {
        Alert.alert(
          t(lang, "shopping", "failedAddItem"),
          e?.message || String(e)
        );
      }
    },
    [lang]
  );

  const deleteFavorite = useCallback(
    async (favoriteId: string) => {
      try {
        const token = await getToken();
        if (!token) {
          Alert.alert(
            t(lang, "shopping", "loginRequiredFavoritesTitle"),
            t(lang, "shopping", "loginRequiredFavoritesMsg")
          );
          return;
        }

        const res = await fetch(`${BASE}/api/favorites/${favoriteId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        const updated: FavoriteItem[] = await res.json().catch(() => []);
        if (!res.ok)
          throw new Error((updated as any)?.error || `HTTP ${res.status}`);

        setFavorites(Array.isArray(updated) ? updated : []);
      } catch (e: any) {
        Alert.alert(
          t(lang, "shopping", "failedUpdateFavorites"),
          e?.message || String(e)
        );
      }
    },
    [lang]
  );

  const toggleShopForFavorite = useCallback(
    async (fav: FavoriteItem, shopId: string) => {
      const currentIds = (fav.shop || []).map((s) =>
        typeof s === "string" ? s : s._id
      );
      const has = currentIds.some((id) => String(id) === String(shopId));
      const nextIds = has
        ? currentIds.filter((id) => String(id) !== String(shopId))
        : [...currentIds, shopId];

      await updateFavorite(fav._id, { shop: nextIds });
    },
    [updateFavorite]
  );

  /* =========================
     ACTIONS: Shop options
  ========================= */
  const handleAddShopOption = useCallback(async () => {
    const trimmed = addingShopName.trim();
    if (!trimmed) return;

    if (
      shopOptions.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      Alert.alert(t(lang, "shopping", "shopAlreadyExists"));
      return;
    }

    try {
      setAddingShopBusy(true);
      const token = await getToken();
      const res = await fetch(`${BASE}/api/shopping-list/shop-options`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: trimmed }),
      });

      const newShop = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error((newShop as any)?.error || `HTTP ${res.status}`);

      setShopOptions((prev) => [...prev, newShop]);
      setAddingShopName("");
    } catch (e: any) {
      Alert.alert(
        t(lang, "shopping", "failedAddShop"),
        e?.message || String(e)
      );
    } finally {
      setAddingShopBusy(false);
    }
  }, [addingShopName, shopOptions, lang]);

  const deleteShopOption = useCallback(
    (shopToDeleteId: string) => {
      Alert.alert(
        t(lang, "shopping", "deleteShopTitle"),
        t(lang, "shopping", "deleteShopMsg"),
        [
          { text: t(lang, "shopping", "cancel"), style: "cancel" },
          {
            text: t(lang, "shopping", "delete"),
            style: "destructive",
            onPress: async () => {
              try {
                const token = await getToken();
                const res = await fetch(
                  `${BASE}/api/shopping-list/shop-options/${shopToDeleteId}`,
                  {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                  }
                );

                if (!res.ok) {
                  const body = await res.text();
                  throw new Error(body || `HTTP ${res.status}`);
                }

                setShopOptions((prev) =>
                  prev.filter((s) => s._id !== shopToDeleteId)
                );

                // lokální cleanup (aby UI hned sedělo)
                setFavorites((prev) =>
                  prev.map((item) => ({
                    ...item,
                    shop: (item.shop || []).filter(
                      (s) => s._id !== shopToDeleteId
                    ),
                  }))
                );
                setNewFavoriteShopIds((prev) =>
                  prev.filter((id) => id !== shopToDeleteId)
                );
              } catch (e: any) {
                Alert.alert("Failed to delete shop", e?.message || String(e));
              }
            },
          },
        ]
      );
    },
    [lang]
  );

  /* =========================
     LOADING / ERROR
  ========================= */
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" />
        <Text style={[styles.centerText, { color: colors.text }]}>
          {t(lang, "favorites", "loading")}
        </Text>
      </View>
    );
  }

  if (err) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.centerText, { color: colors.danger }]}>{err}</Text>

        <Pressable
          style={[
            styles.primaryBtn,
            { marginTop: 12, backgroundColor: colors.pillActive },
          ]}
          onPress={loadAll}
        >
          <Text style={[styles.primaryBtnText, { color: colors.text }]}>
            {t(lang, "shopping", "retry")}
          </Text>
        </Pressable>
      </View>
    );
  }

  /* =========================
     UI
  ========================= */
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.replace("/(tabs)/shopping")}>
          <Text style={[styles.backText, { color: colors.text }]}>
            {t(lang, "favorites", "backToShopping")}
          </Text>
        </Pressable>
      </View>

      {/* INPUT NA NOVÝ FAVORITE */}
      <View style={{ paddingHorizontal: 12, paddingBottom: 4 }}>
        <View
          style={[
            styles.newItemCard,
            {
              backgroundColor: colors.favorite,
              borderColor: "#353535ff",
              borderWidth: 5,
            },
          ]}
        >
          <Text
            style={{
              color: "white",
              fontSize: 18,
              fontWeight: "700",
              marginBottom: 6,
              fontFamily: "MetropolisBold",
            }}
          >
            {t(lang, "favorites", "addFavoriteTitle")}
          </Text>

          <TextInput
            placeholder={t(lang, "favorites", "addFavoritePlaceholder")}
            placeholderTextColor={colors.muted}
            value={newText}
            onChangeText={setNewText}
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
          />

          {shopOptions.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={[styles.label, { color: "white" }]}>
                {t(lang, "shopping", "shopsForItem")}
              </Text>
              <View style={styles.shopsRow}>
                {shopOptions.map((shop) => {
                  const active = newFavoriteShopIds.includes(shop._id);
                  return (
                    <Pressable
                      key={shop._id}
                      style={[
                        styles.chipSmall,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                        active && {
                          backgroundColor: colors.pillActive,
                          borderColor: colors.pillActive,
                        },
                      ]}
                      onPress={() => {
                        setNewFavoriteShopIds((prev) =>
                          prev.includes(shop._id)
                            ? prev.filter((id) => id !== shop._id)
                            : [...prev, shop._id]
                        );
                      }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: colors.text },
                          active && styles.chipTextActive,
                        ]}
                      >
                        {shop.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <Pressable
            style={[
              styles.manageShopsBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => setManageShopsVisible(true)}
          >
            <Text style={[styles.manageShopsText, { color: colors.text }]}>
              {shopOptions.length > 0
                ? t(lang, "shopping", "manageShops")
                : t(lang, "shopping", "addShops")}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.primaryBtn,
              { backgroundColor: "#1a1a1aff" },
              (!newText.trim() || savingFavorite) && { opacity: 0.6 },
            ]}
            onPress={handleAddFavorite}
            disabled={!newText.trim() || savingFavorite}
          >
            <Text style={[styles.primaryBtnText, { color: "white" }]}>
              {savingFavorite
                ? t(lang, "favorites", "saving")
                : t(lang, "favorites", "addFavoriteBtn")}
            </Text>
          </Pressable>
        </View>

        {/* FILTR */}
        <Text style={{ color: colors.text, fontSize: 20, paddingTop: 10 }}>
          {t(lang, "shopping", "filterByShop")}
        </Text>

        {shopOptions.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 8, marginBottom: 4 }}
          >
            <Pressable
              onPress={() => setFilterShopIds([])}
              style={[
                styles.chip,
                { backgroundColor: colors.card, borderColor: colors.border },
                filterShopIds.length === 0 && {
                  backgroundColor: colors.pillActive,
                  borderColor: colors.pillActive,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: colors.text },
                  filterShopIds.length === 0 && styles.chipTextActive,
                ]}
              >
                All
              </Text>
            </Pressable>

            {shopOptions.map((shop) => {
              const active = filterShopIds.includes(shop._id);
              return (
                <Pressable
                  key={shop._id}
                  onPress={() => {
                    setFilterShopIds((prev) =>
                      prev.includes(shop._id)
                        ? prev.filter((id) => id !== shop._id)
                        : [...prev, shop._id]
                    );
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                    active && {
                      backgroundColor: colors.pillActive,
                      borderColor: colors.pillActive,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.text },
                      active && styles.chipTextActive,
                    ]}
                  >
                    {shop.name}
                  </Text>
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => {
                setFilterShopIds((prev) =>
                  prev.includes("No Shop")
                    ? prev.filter((id) => id !== "No Shop")
                    : [...prev, "No Shop"]
                );
              }}
              style={[
                styles.chip,
                { backgroundColor: colors.card, borderColor: colors.border },
                noShopActive && {
                  backgroundColor: colors.pillActive,
                  borderColor: colors.pillActive,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: colors.text },
                  noShopActive && styles.chipTextActive,
                ]}
              >
                No Shop
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </View>

      {/* LIST */}
      {processedFavorites.length === 0 ? (
        <View style={[styles.center, { backgroundColor: colors.background }]} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {processedFavorites.map((item, index) => {
            const shopLabel =
              item.shop && item.shop.length > 0
                ? item.shop.map((s) => s.name).join(", ")
                : t(lang, "shopping", "shopsTitle") + " ▾";

            return (
              <View
                key={item._id}
                style={[
                  styles.row,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemText, { color: colors.text }]}>
                    <Text
                      style={[styles.itemIndex, { color: colors.pillActive }]}
                    >
                      {index + 1}.{" "}
                    </Text>
                    {item.text}
                  </Text>

                  <Pressable
                    style={[
                      styles.shopsBtn,
                      {
                        backgroundColor: colors.shop,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => setEditingFavoriteId(item._id)}
                  >
                    <Text
                      style={[
                        styles.shopsBtnText,
                        { color: colors.secondaryText },
                      ]}
                    >
                      {shopLabel}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.rowButtons}>
                  <Pressable
                    onPress={() => addToShoppingList(item)}
                    style={[
                      styles.smallBtn,
                      {
                        backgroundColor: colors.reverseText,
                        borderWidth: 1,
                        top: 2,
                      },
                    ]}
                  >
                    <MaterialIcons
                      name="add-shopping-cart"
                      size={18}
                      color={colors.text}
                    />
                  </Pressable>

                  <Pressable
                    style={[styles.smallBtn, { backgroundColor: "#7a0202ff" }]}
                    onPress={() => deleteFavorite(item._id)}
                  >
                    <Text style={[styles.smallBtnText, { color: "#fff" }]}>
                      ✕
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Modal – shopy pro konkrétní favorite */}
      <Modal
        visible={!!editingFavorite}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingFavoriteId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingFavorite?.text || t(lang, "shopping", "itemFallback")}
            </Text>

            <Text
              style={[styles.modalSubtitle, { color: colors.secondaryText }]}
            >
              {t(lang, "shopping", "shopsTitle")}
            </Text>

            <ScrollView style={{ maxHeight: 260, marginTop: 8 }}>
              {shopOptions.map((shop) => {
                const itemShopIds =
                  editingFavorite?.shop?.map((s) => String(s._id)) || [];
                const active = itemShopIds.includes(shop._id);

                return (
                  <View
                    key={shop._id}
                    style={[
                      styles.modalRow,
                      { borderBottomColor: colors.border },
                      active && { backgroundColor: colors.card },
                    ]}
                  >
                    <Pressable
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                      onPress={() =>
                        editingFavorite &&
                        toggleShopForFavorite(editingFavorite, shop._id)
                      }
                    >
                      <Text
                        style={[styles.modalRowText, { color: colors.text }]}
                      >
                        {shop.name}
                      </Text>

                      {active && (
                        <Text
                          style={[styles.modalRowText, { color: colors.text }]}
                        >
                          ✓
                        </Text>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>

            <View style={{ marginTop: 12 }}>
              <Text style={styles.label}>
                {t(lang, "shopping", "addNewShopLabel")}
              </Text>

              <View style={styles.addShopRow}>
                <TextInput
                  value={addingShopName}
                  onChangeText={setAddingShopName}
                  placeholder={t(lang, "shopping", "newShopPlaceholder")}
                  placeholderTextColor={colors.muted}
                  style={[
                    styles.input,
                    {
                      flex: 1,
                      marginBottom: 0,
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                />

                <Pressable
                  style={[
                    styles.primaryBtn,
                    {
                      marginLeft: 8,
                      paddingHorizontal: 16,
                      backgroundColor: colors.pillActive,
                    },
                  ]}
                  disabled={addingShopBusy}
                  onPress={handleAddShopOption}
                >
                  <Text style={styles.primaryBtnText}>
                    {addingShopBusy ? "…" : "+"}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              style={[
                styles.secondaryBtn,
                {
                  marginTop: 16,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setEditingFavoriteId(null)}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
                {t(lang, "shopping", "close")}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal – globální správa shopů */}
      <Modal
        visible={manageShopsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setManageShopsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t(lang, "shopping", "manageShopsTitle")}
            </Text>

            <ScrollView style={{ maxHeight: 260, marginTop: 8 }}>
              {shopOptions.map((shop) => (
                <View
                  key={shop._id}
                  style={[
                    styles.modalRow,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <Text style={[styles.modalRowText, { color: colors.text }]}>
                    {shop.name}
                  </Text>

                  <Pressable
                    style={styles.modalDeleteShopBtn}
                    onPress={() => deleteShopOption(shop._id)}
                  >
                    <Text style={styles.modalDeleteShopText}>❌</Text>
                  </Pressable>
                </View>
              ))}

              {shopOptions.length === 0 && (
                <Text style={{ color: "#aaa", marginTop: 4 }}>
                  {t(lang, "shopping", "noShopsYet")}
                </Text>
              )}
            </ScrollView>

            <View style={{ marginTop: 12 }}>
              <Text style={styles.label}>
                {t(lang, "shopping", "addNewShopLabel")}
              </Text>

              <View style={styles.addShopRow}>
                <TextInput
                  value={addingShopName}
                  onChangeText={setAddingShopName}
                  placeholder="New shop name"
                  placeholderTextColor={colors.muted}
                  style={[
                    styles.input,
                    {
                      flex: 1,
                      marginBottom: 0,
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                />
                <Pressable
                  style={[
                    styles.primaryBtn,
                    { marginLeft: 8, paddingHorizontal: 16 },
                  ]}
                  disabled={addingShopBusy}
                  onPress={handleAddShopOption}
                >
                  <Text style={styles.primaryBtnText}>
                    {addingShopBusy ? "…" : "+"}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              style={[
                styles.secondaryBtn,
                {
                  marginTop: 16,
                  backgroundColor: colors.border,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setManageShopsVisible(false)}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
                {t(lang, "shopping", "close")}
              </Text>
            </Pressable>
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
    backgroundColor: "#0f0f0fff",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  centerText: { color: "#e0e0e0", textAlign: "center" },
  headerRow: { paddingHorizontal: 12, paddingBottom: 8 },
  backText: { color: "#d0d0d0", marginBottom: 4 },

  newItemCard: {
    marginTop: 8,
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#323131ff",
    borderColor: "#030303ff",
    borderWidth: 1,
  },

  input: {
    backgroundColor: "#1a1919",
    borderWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    color: "#fff",
    marginBottom: 8,
  },

  label: { color: "#d0d0d0", fontSize: 12, marginBottom: 4 },

  shopsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#444",
    marginRight: 8,
    backgroundColor: "#181818",
  },
  chipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#444",
    backgroundColor: "#181818",
  },
  chipText: { color: "#ccc", fontSize: 12 },
  chipTextActive: { color: "#fff", fontWeight: "700" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    marginTop: 6,
    borderRadius: 8,
    backgroundColor: "#191919",
    borderWidth: 1,
    borderColor: "#151515",
  },

  itemText: { color: "#f5f5f5", fontSize: 19, marginBottom: 4 },
  itemIndex: { color: "#9b2929ff", fontWeight: "800" },

  shopsBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#444",
    backgroundColor: "#222",
  },
  shopsBtnText: { color: "#ccc", fontSize: 11 },

  rowButtons: {
    marginLeft: 8,
    alignItems: "flex-end",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },

  smallBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
  },
  smallBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 12 },

  primaryBtn: {
    backgroundColor: "#171111ff",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },

  secondaryBtn: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ccc",
    backgroundColor: "#434343",
  },
  secondaryBtnText: { color: "#e0e0e0", fontWeight: "700" },

  manageShopsBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#444",
    backgroundColor: "#222",
  },
  manageShopsText: { color: "#ddd", fontSize: 12, fontWeight: "600" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: { backgroundColor: "#212121", borderRadius: 16, padding: 16 },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  modalSubtitle: { color: "#ddd", marginTop: 8, fontWeight: "700" },

  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  modalRowText: { color: "#eee" },

  addShopRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },

  modalDeleteShopBtn: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  modalDeleteShopText: { color: "#fff", fontWeight: "700" },
});
