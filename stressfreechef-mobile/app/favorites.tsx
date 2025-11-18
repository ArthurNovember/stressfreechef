// app/favorites.tsx
import React, { useCallback, useMemo, useState } from "react";
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
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { API_BASE, fetchJSON } from "../lib/api";

const BASE = API_BASE || "https://stressfreecheff-backend.onrender.com";

/** ===== Typy ===== */
type ShopOption = {
  _id: string;
  name: string;
};

type FavoriteItem = {
  _id: string;
  text: string;
  shop: ShopOption[];
};

/** ===== Helpers ===== */
const TOKEN_KEY = "token";

async function getToken() {
  return (await AsyncStorage.getItem(TOKEN_KEY)) || "";
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
export default function FavoritesScreen() {
  const router = useRouter();

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

  /** ==== HW back tlačítko → vždy zpět na shopping tab ==== */
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

  /** ==== Načtení favorites + shop options ==== */
  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error(
          "You are not logged in. Please log in on the MyProfile tab first."
        );
      }

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
      if (isUnauthorizedError(e)) {
        setErr("Your session has expired. Please log in again on MyProfile.");
      } else {
        setErr(e?.message || String(e));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  /** ==== Filtrování favorites podle shopů (stejné jako shopping.tsx) ==== */
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

    // volitelné: nejnovější nahoře (pokud backend vrací podle vytvoření)
    return res.reverse();
  }, [favorites, filterShopIds]);

  /** ==== PATCH favorite (stejně jako updateFavoriteItem na webu) ==== */
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

        const updated: FavoriteItem[] = await res.json();
        if (!res.ok) {
          throw new Error((updated as any)?.error || `HTTP ${res.status}`);
        }

        setFavorites(Array.isArray(updated) ? updated : []);
      } catch (e: any) {
        Alert.alert("Failed to update favorite", e?.message || String(e));
      }
    },
    []
  );

  /** ==== Přidání nového favorite ==== */
  const handleAddFavorite = useCallback(async () => {
    const trimmed = newText.trim();
    if (!trimmed) return;

    try {
      setSavingFavorite(true);
      const token = await getToken();
      if (!token) {
        Alert.alert("Not logged in", "Log in to use favorites.");
        return;
      }

      const res = await fetch(`${BASE}/api/favorites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: trimmed,
          shop: newFavoriteShopIds,
        }),
      });

      const updated: FavoriteItem[] = await res.json();
      if (!res.ok) {
        throw new Error((updated as any)?.error || `HTTP ${res.status}`);
      }

      setFavorites(Array.isArray(updated) ? updated : []);
      setNewText("");
      setNewFavoriteShopIds([]);
    } catch (e: any) {
      Alert.alert("Failed to add favorite", e?.message || String(e));
    } finally {
      setSavingFavorite(false);
    }
  }, [newText, newFavoriteShopIds]);

  /** ==== Přidání z favorite do shopping listu ==== */
  const addToShoppingList = useCallback(async (fav: FavoriteItem) => {
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert("Not logged in", "Log in to save your shopping list.");
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
        body: JSON.stringify({
          text: fav.text,
          shop: shopIds,
        }),
      });

      const updatedList = await res.json();
      if (!res.ok) {
        throw new Error(updatedList?.error || `HTTP ${res.status}`);
      }

      Alert.alert("Added", "Item was added to your shopping list.");
    } catch (e: any) {
      Alert.alert("Failed to add item", e?.message || String(e));
    }
  }, []);

  /** ==== Smazání favorite ==== */
  const deleteFavorite = useCallback(async (favoriteId: string) => {
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert("Not logged in", "Log in to use favorites.");
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

      setFavorites(Array.isArray(updated) ? updated : []);
    } catch (e: any) {
      Alert.alert("Failed to update favorites", e?.message || String(e));
    }
  }, []);

  /** ==== Toggle shop u jednoho favorite (modal) ==== */
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

  /** ==== Add / delete shop options (Manage shops) ==== */
  const handleAddShopOption = useCallback(async () => {
    const trimmed = addingShopName.trim();
    if (!trimmed) return;

    if (
      shopOptions.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      Alert.alert("Shop already exists");
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
      Alert.alert("Failed to add shop", e?.message || String(e));
    } finally {
      setAddingShopBusy(false);
    }
  }, [addingShopName, shopOptions]);

  const deleteShopOption = useCallback((shopToDeleteId: string) => {
    Alert.alert(
      "Delete shop",
      "This will remove this shop from all favorite items. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
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
  }, []);

  /** ==== loading / error ==== */

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.centerText}>Loading favorites…</Text>
      </View>
    );
  }

  if (err) {
    return (
      <View style={styles.center}>
        <Text style={[styles.centerText, { color: "#f77" }]}>{err}</Text>
        <Pressable
          style={[styles.primaryBtn, { marginTop: 12 }]}
          onPress={loadAll}
        >
          <Text style={styles.primaryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const editingFavorite =
    editingFavoriteId != null
      ? favorites.find((f) => f._id === editingFavoriteId) || null
      : null;

  /** ==== UI ==== */
  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.replace("/(tabs)/shopping")}>
          <Text style={styles.backText}>← Back to shopping list</Text>
        </Pressable>
      </View>

      {/* 🔹 INPUT NA NOVÝ FAVORITE */}
      <View style={{ paddingHorizontal: 12, paddingBottom: 4 }}>
        <View style={styles.newItemCard}>
          <Text
            style={{
              color: "#fff",
              fontSize: 18,
              fontWeight: "700",
              marginBottom: 6,
            }}
          >
            Add favorite item
          </Text>

          <TextInput
            placeholder="Add favorite item…"
            placeholderTextColor="#777"
            value={newText}
            onChangeText={setNewText}
            style={styles.input}
          />

          {shopOptions.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.label}>Shops for this item:</Text>
              <View style={styles.shopsRow}>
                {shopOptions.map((shop) => {
                  const active = newFavoriteShopIds.includes(shop._id);
                  return (
                    <Pressable
                      key={shop._id}
                      style={[styles.chipSmall, active && styles.chipActive]}
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
            style={styles.manageShopsBtn}
            onPress={() => setManageShopsVisible(true)}
          >
            <Text style={styles.manageShopsText}>
              {shopOptions.length > 0 ? "Manage shops" : "Add shops"}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.primaryBtn,
              (!newText.trim() || savingFavorite) && { opacity: 0.6 },
            ]}
            onPress={handleAddFavorite}
            disabled={!newText.trim() || savingFavorite}
          >
            <Text style={styles.primaryBtnText}>
              {savingFavorite ? "Saving…" : "Add favorite"}
            </Text>
          </Pressable>
        </View>

        {/* 🔹 FILTR JAKO V SHOPPINGLISTU */}
        <Text style={{ color: "#d9d8d8ff", fontSize: 20, paddingTop: 10 }}>
          Filter by shop:
        </Text>
        {shopOptions.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 8, marginBottom: 4 }}
          >
            {/* All */}
            <Pressable
              onPress={() => setFilterShopIds([])}
              style={[
                styles.chip,
                filterShopIds.length === 0 && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  filterShopIds.length === 0 && styles.chipTextActive,
                ]}
              >
                All
              </Text>
            </Pressable>

            {/* jednotlivé shopy */}
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
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
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
                filterShopIds.includes("No Shop") && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  filterShopIds.includes("No Shop") && styles.chipTextActive,
                ]}
              >
                No Shop
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </View>

      {/* 🔹 SEZNAM FAVORITES (filtrovaný) */}
      {processedFavorites.length === 0 ? (
        <View style={styles.center}></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {processedFavorites.map((item, index) => {
            const shopLabel =
              item.shop && item.shop.length > 0
                ? item.shop.map((s) => s.name).join(", ")
                : "Shops ▾";

            return (
              <View key={item._id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemText}>
                    <Text style={styles.itemIndex}>{index + 1}. </Text>
                    {item.text}
                  </Text>

                  <Pressable
                    style={styles.shopsBtn}
                    onPress={() => setEditingFavoriteId(item._id)}
                  >
                    <Text style={styles.shopsBtnText}>{shopLabel}</Text>
                  </Pressable>
                </View>

                <View style={styles.rowButtons}>
                  <Pressable onPress={() => addToShoppingList(item)}>
                    <Image
                      source={{
                        uri: "https://i.imgur.com/tOVTmT7.png",
                      }}
                      style={{ width: 50, height: 50 }}
                    />
                  </Pressable>
                  <Pressable
                    style={[styles.smallBtn, styles.deleteBtn]}
                    onPress={() => deleteFavorite(item._id)}
                  >
                    <Text style={styles.smallBtnText}>✕</Text>
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
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingFavorite?.text || "Item"}
            </Text>
            <Text style={styles.modalSubtitle}>Shops</Text>

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
                      active && { backgroundColor: "#333" },
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
                      <Text style={styles.modalRowText}>{shop.name}</Text>
                      {active && <Text style={styles.modalRowText}>✓</Text>}
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>

            <View style={{ marginTop: 12 }}>
              <Text style={styles.label}>Add new shop</Text>
              <View style={styles.addShopRow}>
                <TextInput
                  value={addingShopName}
                  onChangeText={setAddingShopName}
                  placeholder="New shop name"
                  placeholderTextColor="#777"
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
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
              onPress={() => setEditingFavoriteId(null)}
            >
              <Text style={styles.secondaryBtnText}>Close</Text>
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
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Manage shops</Text>

            <ScrollView style={{ maxHeight: 260, marginTop: 8 }}>
              {shopOptions.map((shop) => (
                <View key={shop._id} style={styles.modalRow}>
                  <Text style={styles.modalRowText}>{shop.name}</Text>
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
                  No shops yet.
                </Text>
              )}
            </ScrollView>

            <View style={{ marginTop: 12 }}>
              <Text style={styles.label}>Add new shop</Text>
              <View style={styles.addShopRow}>
                <TextInput
                  value={addingShopName}
                  onChangeText={setAddingShopName}
                  placeholder="New shop name"
                  placeholderTextColor="#777"
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
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
              <Text style={styles.secondaryBtnText}>Close</Text>
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
    paddingTop: 40,
  },
  center: {
    flex: 1,
    backgroundColor: "#0f0f0fff",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  centerText: {
    color: "#e0e0e0",
    textAlign: "center",
  },
  headerRow: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  backText: {
    color: "#d0d0d0",
    marginBottom: 4,
  },
  title: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
  },
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
  label: {
    color: "#d0d0d0",
    fontSize: 12,
    marginBottom: 4,
  },
  shopsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
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
    padding: 10,
    marginTop: 6,
    borderRadius: 8,
    backgroundColor: "#191919",
    borderWidth: 1,
    borderColor: "#151515",
  },
  itemText: {
    color: "#f5f5f5",
    fontSize: 19,
    marginBottom: 4,
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
  rowButtons: {
    marginLeft: 8,
    alignItems: "flex-end",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  smallBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
  },
  addBtn: {
    backgroundColor: "#670404ff",
  },
  deleteBtn: {
    backgroundColor: "#4d2626",
  },
  smallBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
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
});
