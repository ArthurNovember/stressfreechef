import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useRouter } from "expo-router";
import { useFocusEffect, useScrollToTop } from "@react-navigation/native";
import { SwipeListView } from "react-native-swipe-list-view";

import { API_BASE, fetchJSON } from "../../lib/api";
import { t, Lang, LANG_KEY } from "../../i18n/strings";
import { useTheme } from "../../theme/ThemeContext";

/* =========================
   TYPES
========================= */

type ShopOption = {
  _id: string;
  name: string;
};

type ShoppingItem = {
  _id: string;
  text: string;
  shop: ShopOption[];
  checked?: boolean;
  createdAt?: string;
};

type ShoppingItemUpdate = {
  checked?: boolean;
  shop?: string[]; // backend čeká jen ID
};

type FavoriteItem = {
  _id: string;
  text: string;
  shop: ShopOption[];
};

/* =========================
   CONSTS
========================= */

const BASE = API_BASE || "https://stressfreecheff-backend.onrender.com";
const TOKEN_KEY = "token";
const GUEST_ITEMS_KEY = "shopping_guest_items";
const SCREEN_WIDTH = Dimensions.get("window").width;

/* =========================
   HELPERS (pure)
========================= */

function isUnauthorizedError(e: any) {
  const msg = String(e?.message ?? e ?? "");
  return (
    /\b401\b/i.test(msg) ||
    /unauthor/i.test(msg) ||
    (/token/i.test(msg) && /invalid|expire|platn/i.test(msg))
  );
}

function normalizeShopIds(shops: any[] | undefined | null) {
  if (!Array.isArray(shops)) return "";
  const ids = shops
    .map((s) => (typeof s === "string" ? s : s?._id))
    .filter(Boolean)
    .map(String)
    .sort();
  return ids.join("|");
}

function isSameFavorite(fav: FavoriteItem, item: ShoppingItem) {
  const favText = (fav.text || "").trim().toLowerCase();
  const itemText = (item.text || "").trim().toLowerCase();
  if (!favText || !itemText) return false;
  if (favText !== itemText) return false;

  const favShops = normalizeShopIds(fav.shop as any);
  const itemShops = normalizeShopIds(item.shop as any);
  return favShops === itemShops;
}

/* =========================
   STORAGE
========================= */

async function getToken() {
  return (await AsyncStorage.getItem(TOKEN_KEY)) || "";
}

async function loadLang(): Promise<Lang> {
  try {
    const stored = await AsyncStorage.getItem(LANG_KEY);
    return stored === "cs" || stored === "en" ? stored : "en";
  } catch {
    return "en";
  }
}

async function loadGuestItems(): Promise<ShoppingItem[]> {
  try {
    const stored = await AsyncStorage.getItem(GUEST_ITEMS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveGuestItems(items: ShoppingItem[]) {
  try {
    await AsyncStorage.setItem(GUEST_ITEMS_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("Failed to save guest shopping list", e);
  }
}

/* =========================
   ACTIONS (API)
========================= */

async function apiLoadAll(token: string) {
  const [list, shops, favorites] = await Promise.all([
    fetchJSON<ShoppingItem[]>(`${BASE}/api/shopping-list`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetchJSON<ShopOption[]>(`${BASE}/api/shopping-list/shop-options`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetchJSON<FavoriteItem[]>(`${BASE}/api/favorites`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  return {
    items: Array.isArray(list) ? list : [],
    shopOptions: Array.isArray(shops) ? shops : [],
    favorites: Array.isArray(favorites) ? favorites : [],
  };
}

async function apiAddItem(token: string, text: string, shopIds: string[]) {
  const res = await fetch(`${BASE}/api/shopping-list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text, shop: shopIds }),
  });

  const updatedList: ShoppingItem[] = await res.json();
  if (!res.ok)
    throw new Error((updatedList as any)?.error || `HTTP ${res.status}`);
  return updatedList;
}

async function apiUpdateItem(
  token: string,
  id: string,
  updates: ShoppingItemUpdate
) {
  const res = await fetch(`${BASE}/api/shopping-list/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });

  const updatedList: ShoppingItem[] = await res.json();
  if (!res.ok)
    throw new Error((updatedList as any)?.error || `HTTP ${res.status}`);
  return updatedList;
}

async function apiDeleteItem(token: string, id: string) {
  await fetch(`${BASE}/api/shopping-list/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function apiAddFavorite(token: string, text: string, shopIds: string[]) {
  const res = await fetch(`${BASE}/api/favorites`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text, shop: shopIds }),
  });

  const updated: FavoriteItem[] = await res.json();
  if (!res.ok) throw new Error((updated as any)?.error || `HTTP ${res.status}`);
  return Array.isArray(updated) ? updated : [];
}

async function apiDeleteFavorite(token: string, favoriteId: string) {
  const res = await fetch(`${BASE}/api/favorites/${favoriteId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  const updated: FavoriteItem[] = await res.json();
  if (!res.ok) throw new Error((updated as any)?.error || `HTTP ${res.status}`);
  return Array.isArray(updated) ? updated : [];
}

async function apiAddShopOption(token: string, name: string) {
  const res = await fetch(`${BASE}/api/shopping-list/shop-options`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });

  const newShop = await res.json();
  if (!res.ok) throw new Error(newShop?.error || `HTTP ${res.status}`);
  return newShop as ShopOption;
}

async function apiDeleteShopOption(token: string, shopId: string) {
  const res = await fetch(`${BASE}/api/shopping-list/shop-options/${shopId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `HTTP ${res.status}`);
  }
}

/* =========================
   SCREEN
========================= */

export default function ShoppingScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const listRef = useRef<SwipeListView<ShoppingItem> | null>(null);
  useScrollToTop(listRef as any);

  // status
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // auth/lang
  const [lang, setLang] = useState<Lang>("en");
  const [hasToken, setHasToken] = useState(false);

  // data
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [shopOptions, setShopOptions] = useState<ShopOption[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);

  // new item
  const [newText, setNewText] = useState("");
  const [newItemShopIds, setNewItemShopIds] = useState<string[]>([]);

  // filter
  const [filterShopIds, setFilterShopIds] = useState<string[]>([]);

  // modals
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [manageShopsVisible, setManageShopsVisible] = useState(false);

  // shop manage
  const [addingShopName, setAddingShopName] = useState("");
  const [addingShopBusy, setAddingShopBusy] = useState(false);

  /* =========================
     INIT
  ========================= */

  useEffect(() => {
    (async () => setLang(await loadLang()))();
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      const token = await getToken();
      const loggedIn = !!token;
      setHasToken(loggedIn);

      if (!loggedIn) {
        const guest = await loadGuestItems();
        setItems(guest);
        setShopOptions([]);
        setFavoriteItems([]);
        return;
      }

      const data = await apiLoadAll(token);
      setItems(data.items);
      setShopOptions(data.shopOptions);
      setFavoriteItems(data.favorites);
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

  const processedItems = useMemo(() => {
    let res = [...items];

    if (filterShopIds.length > 0) {
      res = res.filter((item) => {
        if (!item.shop || item.shop.length === 0)
          return filterShopIds.includes("No Shop");
        const ids = item.shop.map((s) => String(s._id));
        return filterShopIds.some((f) => ids.includes(f));
      });
    }

    // newest first (držím vaši logiku)
    return res.reverse();
  }, [items, filterShopIds]);

  const editingItem = useMemo(() => {
    if (!editingItemId) return null;
    return items.find((it) => it._id === editingItemId) || null;
  }, [editingItemId, items]);

  /* =========================
     CRUD (guest + api)
  ========================= */

  const requireLogin = useCallback((title: string, msg: string) => {
    Alert.alert(title, msg);
  }, []);

  const handleAddItem = useCallback(async () => {
    const trimmed = newText.trim();
    if (!trimmed) return;

    try {
      const token = await getToken();

      // guest
      if (!token) {
        const newItem: ShoppingItem = {
          _id: `guest-${Date.now()}`,
          text: trimmed,
          shop: [],
          checked: false,
          createdAt: new Date().toISOString(),
        };

        setItems((prev) => {
          const updated = [...prev, newItem];
          saveGuestItems(updated);
          return updated;
        });

        setNewText("");
        setNewItemShopIds([]);
        return;
      }

      // logged in
      const updatedList = await apiAddItem(token, trimmed, newItemShopIds);
      setItems(updatedList);
      setNewText("");
      setNewItemShopIds([]);
    } catch (e: any) {
      Alert.alert(
        t(lang, "shopping", "failedAddItem"),
        e?.message || String(e)
      );
    }
  }, [lang, newText, newItemShopIds]);

  const updateItem = useCallback(
    async (id: string, updates: ShoppingItemUpdate) => {
      try {
        const token = await getToken();

        // guest
        if (!token) {
          setItems((prev) => {
            const updated = prev.map((it) => {
              if (it._id !== id) return it;

              // guest: updates.shop je string[] => uděláme placeholder objekty
              let fixedShops = it.shop;
              if (updates.shop) {
                fixedShops = updates.shop.map((sid) => ({
                  _id: sid,
                  name: sid,
                }));
              }

              return { ...it, ...updates, shop: fixedShops };
            });

            saveGuestItems(updated);
            return updated;
          });
          return;
        }

        // logged in
        const updatedList = await apiUpdateItem(token, id, updates);
        setItems(updatedList);
      } catch (e: any) {
        Alert.alert(
          t(lang, "shopping", "updateFailed"),
          e?.message || String(e)
        );
      }
    },
    [lang]
  );

  const deleteItemInstant = useCallback(async (id: string) => {
    // 1) guest – jen lokálně
    const token = await getToken();
    if (!token) {
      setItems((prev) => {
        const updated = prev.filter((it) => it._id !== id);
        saveGuestItems(updated);
        return updated;
      });
      return;
    }

    // 2) UI: hned smaž (animace)
    setItems((prev) => prev.filter((it) => it._id !== id));

    // 3) API delete “na pozadí”
    try {
      await apiDeleteItem(token, id);
    } catch (e: any) {
      console.error("Failed to delete item", e?.message || e);
      // rollback teď neřešíme (stejně jako váš původní přístup)
    }
  }, []);

  const toggleChecked = useCallback(
    async (item: ShoppingItem) => {
      await updateItem(item._id, { checked: !item.checked });
    },
    [updateItem]
  );

  const toggleShopForItem = useCallback(
    async (item: ShoppingItem, shopId: string) => {
      const currentIds = (item.shop || []).map((s) => String(s._id));
      const hasShop = currentIds.includes(shopId);
      const updatedIds = hasShop
        ? currentIds.filter((id) => id !== shopId)
        : [...currentIds, shopId];
      await updateItem(item._id, { shop: updatedIds });
    },
    [updateItem]
  );

  /* =========================
     FAVORITES
  ========================= */

  const addFavoriteFromItem = useCallback(
    async (item: ShoppingItem) => {
      try {
        const token = await getToken();
        if (!token) {
          requireLogin(
            "loginRequiredFavoritesTitle",
            "loginRequiredFavoritesMsg"
          );
          return;
        }

        const shopIds = Array.isArray(item.shop)
          ? item.shop
              .map((s) => (typeof s === "string" ? s : s._id))
              .filter(Boolean)
          : [];

        const updated = await apiAddFavorite(token, item.text, shopIds);
        setFavoriteItems(updated);
      } catch (e: any) {
        Alert.alert(
          t(lang, "shopping", "failedAddFavorite"),
          e?.message || String(e)
        );
      }
    },
    [lang, requireLogin]
  );

  const deleteFavoriteById = useCallback(
    async (favoriteId: string) => {
      try {
        const token = await getToken();
        if (!token) {
          requireLogin(
            "loginRequiredFavoritesTitle",
            "loginRequiredFavoritesMsg"
          );
          return;
        }

        const updated = await apiDeleteFavorite(token, favoriteId);
        setFavoriteItems(updated);
      } catch (e: any) {
        Alert.alert(
          t(lang, "shopping", "failedUpdateFavorites"),
          e?.message || String(e)
        );
      }
    },
    [lang, requireLogin]
  );

  const toggleFavoriteForItem = useCallback(
    async (item: ShoppingItem) => {
      const match = favoriteItems.find((fav) => isSameFavorite(fav, item));
      if (match) await deleteFavoriteById(match._id);
      else await addFavoriteFromItem(item);
    },
    [favoriteItems, addFavoriteFromItem, deleteFavoriteById]
  );

  /* =========================
     SHOP OPTIONS
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
      if (!token) return;

      const newShop = await apiAddShopOption(token, trimmed);
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
                if (!token) return;

                await apiDeleteShopOption(token, shopToDeleteId);

                // options
                setShopOptions((prev) =>
                  prev.filter((s) => s._id !== shopToDeleteId)
                );

                // odeber shop z itemů (lokálně)
                setItems((prev) =>
                  prev.map((item) => ({
                    ...item,
                    shop: (item.shop || []).filter(
                      (s) => s._id !== shopToDeleteId
                    ),
                  }))
                );
              } catch (e: any) {
                Alert.alert(
                  t(lang, "shopping", "failedDeleteShop"),
                  e?.message || String(e)
                );
              }
            },
          },
        ]
      );
    },
    [lang]
  );

  /* =========================
     RENDER
  ========================= */

  const renderItem = useCallback(
    ({ item, index }: { item: ShoppingItem; index: number }) => {
      const shopLabel =
        item.shop && item.shop.length > 0
          ? item.shop.map((s) => s.name).join(", ")
          : `${t(lang, "shopping", "shopsTitle")} ▾`;

      const favMatch = favoriteItems.find((fav) => isSameFavorite(fav, item));
      const isFavorite = !!favMatch;

      return (
        <View
          style={[
            styles.row,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Pressable
            onPress={() => toggleChecked(item)}
            style={[
              styles.checkbox,
              { borderColor: colors.border },
              item.checked && {
                backgroundColor: colors.pillActive,
                borderColor: colors.pillActive,
              },
            ]}
          >
            {item.checked ? <Text style={[styles.checkboxIcon]}>✓</Text> : null}
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.itemText,
                { color: colors.text },
                item.checked && styles.itemTextChecked,
              ]}
            >
              <Text style={[styles.itemIndex, { color: colors.pillActive }]}>
                {index + 1}.{" "}
              </Text>
              {item.text}
            </Text>

            <Pressable
              style={[
                styles.shopsBtn,
                { backgroundColor: colors.shop, borderColor: colors.border },
              ]}
              onPress={() => {
                if (!hasToken) {
                  Alert.alert(
                    t(lang, "shopping", "loginRequiredFavoritesTitle"),
                    t(lang, "shopping", "loginRequiredStoresMsg")
                  );
                  return;
                }
                setEditingItemId(item._id);
              }}
            >
              <Text
                style={[styles.shopsBtnText, { color: colors.secondaryText }]}
              >
                {shopLabel}
              </Text>
            </Pressable>
          </View>

          <Pressable onPress={() => toggleFavoriteForItem(item)}>
            <FontAwesome
              name="heart"
              size={22}
              color={isFavorite ? "#8f0c0cff" : "#5e5c5cff"}
            />
          </Pressable>
        </View>
      );
    },
    [
      colors,
      favoriteItems,
      hasToken,
      lang,
      toggleChecked,
      toggleFavoriteForItem,
    ]
  );

  /* =========================
     LOADING / ERROR
  ========================= */

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" />
        <Text style={{ color: colors.text, marginTop: 8 }}>
          {t(lang, "shopping", "loading")}
        </Text>
      </View>
    );
  }

  if (err) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.danger }]}>{err}</Text>
        <Pressable
          onPress={loadAll}
          style={[
            styles.primaryBtn,
            { marginTop: 12, backgroundColor: colors.pillActive },
          ]}
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
      <SwipeListView
        listViewRef={(ref) => {
          listRef.current = ref;
        }}
        data={processedItems}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        renderHiddenItem={() => <View />}
        rightOpenValue={-SCREEN_WIDTH} // swipe přes celou šířku
        disableRightSwipe
        swipeToOpenPercent={50}
        onRowDidOpen={(rowKey: string) => {
          deleteItemInstant(rowKey);
        }}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {/* ADD NEW ITEM */}
            <View
              style={[
                styles.newItemCard,
                {
                  backgroundColor: colors.list,
                  borderColor: "#171717ff",
                  borderWidth: 5,
                },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{
                    fontFamily: "MetropolisBold",
                    fontSize: 34,
                    color: "#c2c2c2ff",
                    paddingTop: 10,
                    letterSpacing: 0.5,
                  }}
                >
                  {t(lang, "shopping", "addNewItemTitle")}
                </Text>

                <Pressable
                  onPress={() => {
                    if (!hasToken) {
                      Alert.alert(
                        t(lang, "shopping", "loginRequiredFavoritesTitle"),
                        t(lang, "shopping", "loginRequiredFavoritesMsg")
                      );
                      return;
                    }
                    router.push("/favorites");
                  }}
                >
                  <Image
                    source={{ uri: "https://i.imgur.com/DmXZvGl.png" }}
                    style={{ width: 70, height: 70 }}
                  />
                </Pressable>
              </View>

              <TextInput
                placeholder={t(lang, "shopping", "addItemPlaceholder")}
                placeholderTextColor="#777"
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

              {/* select shops for new item */}
              {hasToken && shopOptions.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={[styles.label, { color: "white" }]}>
                    {t(lang, "shopping", "shopsForItem")}
                  </Text>

                  <View style={styles.shopsRow}>
                    {shopOptions.map((shop) => {
                      const active = newItemShopIds.includes(shop._id);
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
                              backgroundColor: "#b30d0dff",
                              borderColor: colors.pillActive,
                            },
                          ]}
                          onPress={() => {
                            setNewItemShopIds((prev) =>
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

              {/* manage shops */}
              {hasToken && (
                <Pressable
                  style={[
                    styles.manageShopsBtn,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => setManageShopsVisible(true)}
                >
                  <Text
                    style={[styles.manageShopsText, { color: colors.text }]}
                  >
                    {shopOptions.length > 0
                      ? t(lang, "shopping", "manageShops")
                      : t(lang, "shopping", "addShops")}
                  </Text>
                </Pressable>
              )}

              <Pressable
                style={[styles.primaryBtn, { backgroundColor: "#111111ff" }]}
                onPress={handleAddItem}
              >
                <Text style={[styles.primaryBtnText, { color: "white" }]}>
                  {t(lang, "shopping", "sendToList")}
                </Text>
              </Pressable>
            </View>

            {/* FILTER */}
            <View style={{ padding: 12 }}>
              {hasToken && (
                <Text
                  style={{ color: colors.text, fontSize: 20, paddingTop: 10 }}
                >
                  {t(lang, "shopping", "filterByShop")}
                </Text>
              )}

              {hasToken && shopOptions.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 8, marginBottom: 4 }}
                >
                  <Pressable
                    onPress={() => setFilterShopIds([])}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.card },
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
                      {t(lang, "shopping", "all")}
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
                          { backgroundColor: colors.card },
                          active && styles.chipActive,
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
                      { backgroundColor: colors.card },
                      filterShopIds.includes("No Shop") && styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: colors.text },
                        filterShopIds.includes("No Shop") &&
                          styles.chipTextActive,
                      ]}
                    >
                      {t(lang, "shopping", "noShop")}
                    </Text>
                  </Pressable>
                </ScrollView>
              )}
            </View>
          </>
        }
      />

      {/* MODAL: item shops */}
      <Modal
        visible={!!editingItem}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingItemId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingItem?.text || t(lang, "shopping", "itemFallback")}
            </Text>

            <Text
              style={[styles.modalSubtitle, { color: colors.secondaryText }]}
            >
              {t(lang, "shopping", "shopsTitle")}
            </Text>

            <ScrollView style={{ maxHeight: 260, marginTop: 8 }}>
              {shopOptions.map((shop) => {
                const itemShopIds =
                  editingItem?.shop?.map((s) => String(s._id)) || [];
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
                        editingItem && toggleShopForItem(editingItem, shop._id)
                      }
                    >
                      <Text
                        style={[styles.modalRowText, { color: colors.text }]}
                      >
                        {shop.name}
                      </Text>
                      {active ? (
                        <Text
                          style={[styles.modalRowText, { color: colors.text }]}
                        >
                          ✓
                        </Text>
                      ) : null}
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
                  borderColor: colors.border,
                  backgroundColor: colors.border,
                },
              ]}
              onPress={() => setEditingItemId(null)}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
                {t(lang, "shopping", "close")}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* MODAL: manage shops */}
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
                <View key={shop._id} style={styles.modalRow}>
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
                <Text style={{ color: colors.muted, marginTop: 4 }}>
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
              style={[styles.secondaryBtn, { marginTop: 16 }]}
              onPress={() => setManageShopsVisible(false)}
            >
              <Text style={styles.secondaryBtnText}>
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
  screen: {
    flex: 1,
    paddingTop: 20,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },

  errorText: {
    fontWeight: "700",
    textAlign: "center",
  },

  newItemCard: {
    marginTop: 8,
    marginBottom: 12,
    padding: 10,
  },

  input: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
  },

  label: {
    color: "#d0d0d0",
    fontSize: 12,
    marginBottom: 4,
  },

  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 8,
  },

  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
  },

  secondaryBtn: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ccc",
    backgroundColor: "#434343",
  },

  secondaryBtnText: {
    color: "#e0e0e0",
    fontWeight: "700",
  },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
  },

  chipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },

  chipActive: {
    backgroundColor: "#8b0e0d",
    borderColor: "#aa2b2a",
  },

  chipText: {
    fontSize: 12,
  },

  chipTextActive: {
    color: "#fff",
    fontWeight: "700",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
    padding: 10,
    marginTop: 6,
    borderRadius: 8,
    borderWidth: 1,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  checkboxIcon: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },

  itemText: {
    fontSize: 19,
    marginBottom: 4,
  },

  itemTextChecked: {
    color: "#888",
    textDecorationLine: "line-through",
  },

  itemIndex: {
    fontWeight: "800",
  },

  shopsBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },

  shopsBtnText: {
    fontSize: 11,
  },

  shopsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 16,
  },

  modalCard: {
    borderRadius: 16,
    padding: 16,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },

  modalSubtitle: {
    marginTop: 8,
    fontWeight: "700",
  },

  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  modalRowText: {},

  addShopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },

  modalDeleteShopBtn: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },

  modalDeleteShopText: {
    color: "#fff",
    fontWeight: "700",
  },

  manageShopsBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },

  manageShopsText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
