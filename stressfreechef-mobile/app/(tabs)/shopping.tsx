import React, { useCallback, useMemo, useState, useEffect } from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useRouter } from "expo-router";
import { t, Lang, LANG_KEY } from "../../i18n/strings";
import { useTheme } from "../../theme/ThemeContext";
import { useScrollToTop } from "@react-navigation/native";
import { useRef } from "react";

import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { API_BASE, fetchJSON } from "../../lib/api";
import { SwipeListView } from "react-native-swipe-list-view";

import { Dimensions } from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;

const BASE = API_BASE || "https://stressfreecheff-backend.onrender.com";

/** ===== Typy ===== */
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

/** ===== Helpers ===== */
const TOKEN_KEY = "token";
const GUEST_ITEMS_KEY = "shopping_guest_items";

async function getToken() {
  return (await AsyncStorage.getItem(TOKEN_KEY)) || "";
}

async function saveGuestItems(items: ShoppingItem[]) {
  try {
    await AsyncStorage.setItem(GUEST_ITEMS_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("Failed to save guest shopping list", e);
  }
}

const isUnauthorizedError = (e: any) => {
  const msg = String(e?.message ?? e ?? "");
  return (
    /\b401\b/i.test(msg) ||
    /unauthor/i.test(msg) ||
    (/token/i.test(msg) && /invalid|expire|platn/i.test(msg))
  );
};

/** ===== Hlavní screen ===== */
export default function ShoppingScreen() {
  const { colors } = useTheme(); // 🎨 theme barvy
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [shopOptions, setShopOptions] = useState<ShopOption[]>([]);

  const [newText, setNewText] = useState("");
  const [newItemShopIds, setNewItemShopIds] = useState<string[]>([]);

  const [filterShopIds, setFilterShopIds] = useState<string[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [addingShopName, setAddingShopName] = useState("");
  const [addingShopBusy, setAddingShopBusy] = useState(false);

  const [manageShopsVisible, setManageShopsVisible] = useState(false);

  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);

  const [lang, setLang] = useState<Lang>("en");

  const [hasToken, setHasToken] = useState(false);

  const router = useRouter();

  const listRef = React.useRef<SwipeListView<ShoppingItem> | null>(null);
  useScrollToTop(listRef as any);

  /** ===== Načtení dat (stejně jako web) ===== */
  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const token = await getToken();
      const loggedIn = !!token;
      setHasToken(loggedIn);

      if (!loggedIn) {
        const stored = await AsyncStorage.getItem(GUEST_ITEMS_KEY);

        if (stored) {
          try {
            setItems(JSON.parse(stored));
          } catch {
            setItems([]);
          }
        } else {
          setItems([]);
        }

        setShopOptions([]);
        setFavoriteItems([]);

        return; // ← důležité
      }

      if (!token) {
        throw new Error(
          "You are not logged in. Please log in on the MyProfile tab first."
        );
      }

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

      setItems(Array.isArray(list) ? list : []);
      setShopOptions(Array.isArray(shops) ? shops : []);
      setFavoriteItems(Array.isArray(favorites) ? favorites : []);
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        setErr(t(lang, "shopping", "sessionExpired"));
      } else {
        setErr(e?.message || String(e));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(LANG_KEY);
      if (stored === "cs" || stored === "en") setLang(stored);
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  /** ===== CRUD – backend vrací vždy celé pole (stejně jako web) ===== */

  const handleAddItem = useCallback(async () => {
    const trimmed = newText.trim();
    if (!trimmed) return;

    try {
      const token = await getToken();
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

        return; // důležité
      }

      const res = await fetch(`${BASE}/api/shopping-list`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: trimmed,
          shop: newItemShopIds, // pole ID shopů
        }),
      });

      const updatedList: ShoppingItem[] = await res.json();
      if (!res.ok) {
        throw new Error(
          (updatedList as any)?.["error"] || `HTTP ${res.status}`
        );
      }

      setItems(updatedList);
      setNewText("");
      setNewItemShopIds([]);
    } catch (e: any) {
      Alert.alert(
        t(lang, "shopping", "failedAddItem"),
        e?.message || String(e)
      );
    }
  }, [newText, newItemShopIds]);

  const updateItem = useCallback(
    async (id: string, updates: ShoppingItemUpdate) => {
      try {
        const token = await getToken();
        if (!token) {
          setItems((prev) => {
            const updated = prev.map((it) => {
              if (it._id !== id) return it;

              // převod shop: string[] → ShopOption[]
              let fixedShops = it.shop;
              if (updates.shop) {
                fixedShops = updates.shop.map((sid) => ({
                  _id: sid,
                  name: sid, // guest nemá názvy shopů → placeholder
                }));
              }

              return {
                ...it,
                ...updates,
                shop: fixedShops,
              };
            });

            saveGuestItems(updated);
            return updated;
          });
          return;
        }

        const res = await fetch(`${BASE}/api/shopping-list/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updates),
        });

        const updatedList: ShoppingItem[] = await res.json();
        if (!res.ok) {
          throw new Error(
            (updatedList as any)?.["error"] || `HTTP ${res.status}`
          );
        }

        setItems(updatedList);
      } catch (e: any) {
        Alert.alert(
          t(lang, "shopping", "updateFailed"),
          e?.message || String(e)
        );
      }
    },
    []
  );

  const deleteItem = useCallback(
    (id: string) => {
      (async () => {
        const token = await getToken();
        if (!token) {
          setItems((prev) => {
            const updated = prev.filter((it) => it._id !== id);
            saveGuestItems(updated);
            return updated;
          });
          return;
        }
      })();

      // 2) Okamžitě upravit state – tady se animace aplikuje
      setItems((prev) => prev.filter((it) => it._id !== id));

      // 3) DELETE na backend pošleme „na pozadí“
      (async () => {
        try {
          const token = await getToken();
          if (!token) {
            console.warn("No token – cannot delete item");
            return;
          }

          await fetch(`${BASE}/api/shopping-list/${id}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } catch (e: any) {
          console.error("Failed to delete item", e?.message || e);
          // když budeš chtít, můžeš tady někdy v budoucnu řešit rollback
        }
      })();
    },
    [BASE, getToken]
  );

  const addFavoriteFromItem = useCallback(async (item: ShoppingItem) => {
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert(
          t(lang, "shopping", "loginRequiredFavoritesTitle"),
          t(lang, "shopping", "loginRequiredFavoritesMsg")
        );

        return;
      }

      const shopIds = Array.isArray(item.shop)
        ? item.shop
            .map((s) => (typeof s === "string" ? s : s._id))
            .filter(Boolean)
        : [];

      const res = await fetch(`${BASE}/api/favorites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: item.text,
          shop: shopIds, // 👈 stejné jako web
        }),
      });

      const updated: FavoriteItem[] = await res.json();
      if (!res.ok) {
        throw new Error((updated as any)?.error || `HTTP ${res.status}`);
      }

      setFavoriteItems(Array.isArray(updated) ? updated : []);
    } catch (e: any) {
      Alert.alert(
        t(lang, "shopping", "failedAddFavorite"),
        e?.message || String(e)
      );
    }
  }, []);

  const deleteFavoriteById = useCallback(async (favoriteId: string) => {
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const updated: FavoriteItem[] = await res.json();
      if (!res.ok) {
        throw new Error((updated as any)?.error || `HTTP ${res.status}`);
      }

      setFavoriteItems(Array.isArray(updated) ? updated : []);
    } catch (e: any) {
      Alert.alert(
        t(lang, "shopping", "failedUpdateFavorites"),
        e?.message || String(e)
      );
    }
  }, []);

  const toggleFavoriteForItem = useCallback(
    async (item: ShoppingItem) => {
      const favMatch = favoriteItems.find((fav) => isSameFavorite(fav, item));

      if (favMatch) {
        await deleteFavoriteById(favMatch._id);
      } else {
        await addFavoriteFromItem(item);
      }
    },
    [favoriteItems, addFavoriteFromItem, deleteFavoriteById]
  );

  const toggleChecked = useCallback(
    async (item: ShoppingItem) => {
      await updateItem(item._id, { checked: !item.checked });
    },
    [updateItem]
  );

  const toggleShopForItem = useCallback(
    async (item: ShoppingItem, shopId: string) => {
      const currentlySelectedIds = (item.shop || []).map((s) => String(s._id));
      const hasShop = currentlySelectedIds.includes(shopId);
      const updatedIds = hasShop
        ? currentlySelectedIds.filter((id) => id !== shopId)
        : [...currentlySelectedIds, shopId];

      await updateItem(item._id, { shop: updatedIds });
    },
    [updateItem]
  );

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

      const newShop = await res.json();
      if (!res.ok) {
        throw new Error(newShop?.error || `HTTP ${res.status}`);
      }

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
  }, [addingShopName, shopOptions]);

  const deleteShopOption = useCallback(async (shopToDeleteId: string) => {
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

              // 🧼 Lokálně smaž shop z options…
              setShopOptions((prev) =>
                prev.filter((s) => s._id !== shopToDeleteId)
              );

              // …a zároveň ho odeber ze všech položek
              setItems((prevItems) =>
                prevItems.map((item) => ({
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
  }, []);

  /** ===== Filtrování + default newest first ===== */

  const processedItems = useMemo(() => {
    let res = [...items];

    if (filterShopIds.length > 0) {
      res = res.filter((item) => {
        if (!item.shop || item.shop.length === 0) {
          return filterShopIds.includes("No Shop");
        }
        const ids = item.shop.map((s) => String(s._id));
        return filterShopIds.some((f) => ids.includes(f));
      });
    }

    // Nejnovější nahoře
    return res.reverse();
  }, [items, filterShopIds]);

  /** ===== Render jednoho itemu ===== */
  const normalizeShops = (shops: any[] | undefined | null) => {
    if (!Array.isArray(shops)) return "";
    // shops může být pole stringů nebo objektů { _id, name }
    const ids = shops
      .map((s) => (typeof s === "string" ? s : s._id))
      .filter(Boolean)
      .map((id) => String(id))
      .sort(); // aby nezáleželo na pořadí
    return ids.join("|");
  };

  const isSameFavorite = (fav: FavoriteItem, item: ShoppingItem) => {
    const favText = fav.text?.trim().toLowerCase() || "";
    const itemText = item.text?.trim().toLowerCase() || "";

    if (!favText || !itemText) return false;
    if (favText !== itemText) return false;

    // porovnat obchody
    const favShops = normalizeShops(fav.shop as any);
    const itemShops = normalizeShops(item.shop as any);

    return favShops === itemShops;
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: ShoppingItem;
    index: number;
  }) => {
    const shopLabel =
      item.shop && item.shop.length > 0
        ? item.shop.map((s) => s.name).join(", ")
        : t(lang, "shopping", "shopsTitle") + " ▾";

    const favMatch = favoriteItems.find((fav) => isSameFavorite(fav, item));
    const isFavorite = !!favMatch;

    return (
      <View
        style={[
          styles.row,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
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
          {item.checked ? (
            <Text style={[styles.checkboxIcon, { color: "white" }]}>✓</Text>
          ) : null}
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
              {
                backgroundColor: colors.shop,
                borderColor: colors.border,
              },
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
        {/* ❤️ srdce jako na webu */}
        <Pressable onPress={() => toggleFavoriteForItem(item)}>
          <FontAwesome
            name="heart"
            size={22}
            color={isFavorite ? "#8f0c0cff" : "#5e5c5cff"}
          />
        </Pressable>
      </View>
    );
  };

  /** ===== Loading / error ===== */

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

  const editingItem =
    editingItemId != null
      ? items.find((it) => it._id === editingItemId) || null
      : null;

  /** ===== UI ===== */

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SwipeListView
        listViewRef={(ref) => {
          listRef.current = ref;
        }}
        data={processedItems}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        renderHiddenItem={() => <View />} // nic neukazujeme
        rightOpenValue={-SCREEN_WIDTH} // 👈 odjeď přes celou šířku
        disableRightSwipe
        swipeToOpenPercent={50} // stačí cca půlka swipu, doladíš
        onRowDidOpen={(rowKey: string) => {
          deleteItem(rowKey); // swipe = rovnou smaž
        }}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {/* Nový item */}
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
              <View>
                <View
                  style={{
                    justifyContent: "space-between",
                    flexDirection: "row",
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
                      source={{
                        uri: "https://i.imgur.com/DmXZvGl.png",
                      }}
                      style={{ width: 70, height: 70 }}
                    />
                  </Pressable>
                </View>
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
            <View style={{ padding: 12 }}>
              {hasToken && (
                <Text
                  style={{ color: colors.text, fontSize: 20, paddingTop: 10 }}
                >
                  {t(lang, "shopping", "filterByShop")}
                </Text>
              )}
              {/* Filtrování podle shopů */}
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
                      {
                        backgroundColor: colors.card,
                      },
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

                  {/* No Shop */}
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
                      {
                        backgroundColor: colors.card,
                      },
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

      {/* Modal – úprava shopů konkrétní položky */}
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
              {" "}
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
                    {/* Klik na řádek = přidat/odebrat shop u itemu */}
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
                {" "}
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
                  <Text style={[styles.primaryBtnText]}>
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
                {" "}
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
              {" "}
              {t(lang, "shopping", "manageShopsTitle")}
            </Text>

            {/* seznam shopů s mazáním */}
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

            {/* přidání nového shopu */}
            <View style={{ marginTop: 12 }}>
              <Text style={styles.label}>
                {" "}
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
              style={[styles.secondaryBtn, { marginTop: 16 }]}
              onPress={() => setManageShopsVisible(false)}
            >
              <Text style={styles.secondaryBtnText}>
                {" "}
                {t(lang, "shopping", "close")}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** ===== Styly ===== */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0f0f0fff",
    paddingTop: 20,
  },
  center: {
    flex: 1,
    backgroundColor: "#0f0f0fff",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  errorText: {
    color: "#f77",
    fontWeight: "700",
    textAlign: "center",
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 8,
    marginBottom: 4,
  },
  newItemCard: {
    marginTop: 8,
    marginBottom: 12,
    padding: 10,

    backgroundColor: "#530f0fff",
    borderColor: "#4a0505ff",
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
  label: {
    color: "#d0d0d0",
    fontSize: 12,
    marginBottom: 4,
  },
  primaryBtn: {
    backgroundColor: "#171111ff",
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
  chipActive: {
    backgroundColor: "#8b0e0d",
    borderColor: "#aa2b2a",
  },
  chipText: {
    color: "#ccc",
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
    backgroundColor: "#191919",
    borderWidth: 1,
    borderColor: "#151515",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#888",
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#8b0e0d",
    borderColor: "#8b0e0d",
  },
  checkboxIcon: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  itemText: {
    color: "#f5f5f5",
    fontSize: 19,
    marginBottom: 4,
  },
  itemTextChecked: {
    color: "#888",
    textDecorationLine: "line-through",
  },
  itemIndex: {
    color: "#9b2929ff",
    fontWeight: "800",
  },
  shopsBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#444",
    backgroundColor: "#222",
  },
  shopsBtnText: {
    color: "#ccc",
    fontSize: 11,
  },
  deleteBtn: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#750c0c",
  },
  deleteBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  shopsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  emptyText: {
    marginTop: 8,
    color: "#999",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#212121",
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  modalSubtitle: {
    color: "#ddd",
    marginTop: 8,
    fontWeight: "700",
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  modalRowText: {
    color: "#eee",
  },
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
    borderColor: "#444",
    backgroundColor: "#222",
  },
  manageShopsText: {
    color: "#ddd",
    fontSize: 12,
    fontWeight: "600",
  },
});
