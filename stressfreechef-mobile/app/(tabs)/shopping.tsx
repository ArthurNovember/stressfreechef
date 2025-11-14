import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
export default function ShoppingScreen() {
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

  const [active, setActive] = useState(false);

  const [manageShopsVisible, setManageShopsVisible] = useState(false);

  /** ===== Načtení dat (stejně jako web) ===== */
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

      const [list, shops] = await Promise.all([
        fetchJSON<ShoppingItem[]>(`${BASE}/api/shopping-list`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetchJSON<ShopOption[]>(`${BASE}/api/shopping-list/shop-options`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setItems(Array.isArray(list) ? list : []);
      setShopOptions(Array.isArray(shops) ? shops : []);
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

  /** ===== CRUD – backend vrací vždy celé pole (stejně jako web) ===== */

  const handleAddItem = useCallback(async () => {
    const trimmed = newText.trim();
    if (!trimmed) return;

    try {
      const token = await getToken();
      if (!token) {
        Alert.alert("Not logged in", "Log in to save your shopping list.");
        return;
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
      Alert.alert("Failed to add item", e?.message || String(e));
    }
  }, [newText, newItemShopIds]);

  const updateItem = useCallback(
    async (id: string, updates: ShoppingItemUpdate) => {
      try {
        const token = await getToken();
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
        Alert.alert("Update failed", e?.message || String(e));
      }
    },
    []
  );

  const deleteItem = useCallback(async (id: string) => {
    Alert.alert("Delete item", "Do you want to delete this item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await getToken();
            const res = await fetch(`${BASE}/api/shopping-list/${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });

            const updatedList: ShoppingItem[] = await res.json();
            if (!res.ok) {
              throw new Error(
                (updatedList as any)?.["error"] || `HTTP ${res.status}`
              );
            }

            setItems(updatedList);
          } catch (e: any) {
            Alert.alert("Deletion failed", e?.message || String(e));
          }
        },
      },
    ]);
  }, []);

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

  const deleteShopOption = useCallback(async (shopToDeleteId: string) => {
    Alert.alert(
      "Delete shop",
      "This will remove this shop from all items. Continue?",
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
              Alert.alert("Failed to delete shop", e?.message || String(e));
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
        : "Shops ▾";

    return (
      <View style={styles.row}>
        <Pressable
          onPress={() => toggleChecked(item)}
          style={[styles.checkbox, item.checked && styles.checkboxChecked]}
        >
          {item.checked ? <Text style={styles.checkboxIcon}>✓</Text> : null}
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text
            style={[styles.itemText, item.checked && styles.itemTextChecked]}
          >
            <Text style={styles.itemIndex}>{index + 1}. </Text>
            {item.text}
          </Text>
          <Pressable
            style={styles.shopsBtn}
            onPress={() => setEditingItemId(item._id)}
          >
            <Text style={styles.shopsBtnText}>{shopLabel}</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => deleteItem(item._id)}
          style={styles.deleteBtn}
        >
          <Text style={styles.deleteBtnText}>✕</Text>
        </Pressable>
      </View>
    );
  };

  /** ===== Loading / error ===== */

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ color: "#fff", marginTop: 8 }}>
          Loading shopping list…
        </Text>
      </View>
    );
  }

  if (err) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{err}</Text>
        <Pressable
          onPress={loadAll}
          style={[styles.primaryBtn, { marginTop: 12 }]}
        >
          <Text style={styles.primaryBtnText}>Retry</Text>
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
    <View style={styles.screen}>
      <FlatList
        data={processedItems}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {/* Nový item */}
            <View style={styles.newItemCard}>
              <Pressable onPress={() => setActive(!active)}>
                <View
                  style={{
                    justifyContent: "space-between",
                    flexDirection: "row",
                  }}
                >
                  <Text
                    style={{ color: "white", fontSize: 35, paddingTop: 10 }}
                  >
                    Shopping List
                  </Text>
                  <Image
                    source={{
                      uri: active
                        ? "https://i.imgur.com/PwVAgWN.png"
                        : "https://i.imgur.com/DmXZvGl.png",
                    }}
                    style={{ width: 70, height: 70 }}
                  />
                </View>
              </Pressable>
              <TextInput
                placeholder="Add item…"
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
                      const active = newItemShopIds.includes(shop._id);
                      return (
                        <Pressable
                          key={shop._id}
                          style={[
                            styles.chipSmall,
                            active && styles.chipActive,
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

              {shopOptions.length > 0 && (
                <Pressable
                  style={styles.manageShopsBtn}
                  onPress={() => setManageShopsVisible(true)}
                >
                  <Text style={styles.manageShopsText}>Manage Shops</Text>
                </Pressable>
              )}

              <Pressable style={styles.primaryBtn} onPress={handleAddItem}>
                <Text style={styles.primaryBtnText}>Send to list</Text>
              </Pressable>
            </View>

            {/* Filtrování podle shopů */}
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
                      filterShopIds.includes("No Shop") &&
                        styles.chipTextActive,
                    ]}
                  >
                    No Shop
                  </Text>
                </Pressable>
              </ScrollView>
            )}

            {processedItems.length === 0 && (
              <Text style={styles.emptyText}>
                Your shopping list is empty. Add your first item!
              </Text>
            )}
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
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingItem?.text || "Item"}</Text>
            <Text style={styles.modalSubtitle}>Shops</Text>

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
                      active && { backgroundColor: "#333" },
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
                      <Text style={styles.modalRowText}>{shop.name}</Text>
                      {active && <Text style={styles.modalRowText}>✓</Text>}
                    </Pressable>

                    {/* ❌ – smaže shop všude */}
                    <Pressable
                      style={styles.modalDeleteShopBtn}
                      onPress={() => deleteShopOption(shop._id)}
                    >
                      <Text style={styles.modalDeleteShopText}>❌</Text>
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
              onPress={() => setEditingItemId(null)}
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

            {/* seznam shopů s mazáním */}
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

            {/* přidání nového shopu */}
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
              <Text style={styles.secondaryBtnText}>Zavřít</Text>
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
    borderRadius: 10,
    backgroundColor: "#181818",
    borderColor: "#222",
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
    backgroundColor: "#570303",
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
