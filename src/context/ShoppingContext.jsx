import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getToken } from "../api/client";
import * as api from "../api/shoppingList";

const LOCAL_KEY = "sfc_shoppingList";

function loadLocalList() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
  } catch {
    return [];
  }
}

function saveLocalList(list) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
}

function genLocalId() {
  return String(Date.now()) + "_" + Math.random().toString(16).slice(2);
}

const ShoppingContext = createContext(null);

export function ShoppingProvider({ children }) {
  const [items, setItems] = useState([]);
  const [shopOptions, setShopOptions] = useState([]);
  const [uniqueItemNames, setUniqueItemNames] = useState([]);

  const refreshSuggestions = useCallback(async () => {
    const token = getToken();
    if (!token) {
      const names = [
        ...new Set(
          loadLocalList()
            .map((i) => (i.text || "").trim())
            .filter(Boolean),
        ),
      ];
      setUniqueItemNames(names);
      return;
    }
    try {
      const data = await api.getItemSuggestions();
      setUniqueItemNames(data);
    } catch (e) {
      console.error("Suggestions fetch failed:", e);
    }
  }, []);

  const fetchList = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setItems(loadLocalList());
      return;
    }
    try {
      const data = await api.getShoppingList();
      setItems(data);
    } catch (e) {
      console.error("Shopping list fetch failed:", e);
    }
  }, []);

  const fetchShopOptions = useCallback(async () => {
    if (!getToken()) {
      setShopOptions([]);
      return;
    }
    try {
      const data = await api.getShopOptions();
      setShopOptions(data);
    } catch (e) {
      console.error("Shop options fetch failed:", e);
    }
  }, []);

  const addItem = useCallback(
    async (item) => {
      const token = getToken();
      if (!token) {
        const current = loadLocalList();
        const newObj = {
          _id: genLocalId(),
          text: item?.text || "",
          shop: [],
          checked: false,
        };
        const updated = [...current, newObj];
        saveLocalList(updated);
        setItems(updated);
        return;
      }
      const updated = await api.addShoppingItem(item);
      setItems(updated);
      await refreshSuggestions();
    },
    [refreshSuggestions],
  );

  const updateItem = useCallback(
    async (itemId, updates) => {
      const token = getToken();
      if (!token) {
        const current = loadLocalList();
        const updated = current.map((i) =>
          i._id === itemId
            ? { ...i, ...("checked" in updates ? { checked: updates.checked } : {}) }
            : i,
        );
        saveLocalList(updated);
        setItems(updated);
        return;
      }
      const updated = await api.updateShoppingItem(itemId, updates);
      setItems(updated);
      await refreshSuggestions();
    },
    [refreshSuggestions],
  );

  const deleteItem = useCallback(
    async (itemId) => {
      const token = getToken();
      if (!token) {
        const current = loadLocalList();
        const updated = current.filter((i) => i._id !== itemId);
        saveLocalList(updated);
        setItems(updated);
        return;
      }
      const updated = await api.deleteShoppingItem(itemId);
      setItems(updated);
      await refreshSuggestions();
    },
    [refreshSuggestions],
  );

  const addShopOption = useCallback(async (name) => {
    const newShop = await api.addShopOption(name);
    setShopOptions((prev) => [...prev, newShop]);
    return newShop;
  }, []);

  const removeShopOption = useCallback(async (shopId) => {
    await api.deleteShopOption(shopId);
    setShopOptions((prev) => prev.filter((s) => s._id !== shopId));
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        shop: item.shop.filter((s) => s._id !== shopId),
      })),
    );
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([fetchList(), fetchShopOptions(), refreshSuggestions()]);
  }, [fetchList, fetchShopOptions, refreshSuggestions]);

  useEffect(() => {
    fetchList();
    fetchShopOptions();
    refreshSuggestions();
  }, []);

  return (
    <ShoppingContext.Provider
      value={{
        items,
        shopOptions,
        setShopOptions,
        uniqueItemNames,
        addItem,
        updateItem,
        deleteItem,
        addShopOption,
        removeShopOption,
        refreshSuggestions,
        refresh,
      }}
    >
      {children}
    </ShoppingContext.Provider>
  );
}

export function useShopping() {
  return useContext(ShoppingContext);
}
