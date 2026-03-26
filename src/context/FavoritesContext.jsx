import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getToken } from "../api/client";
import * as api from "../api/favorites";

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const [items, setItems] = useState([]);

  const fetchFavorites = useCallback(async () => {
    if (!getToken()) {
      setItems([]);
      return;
    }
    try {
      const data = await api.getFavorites();
      setItems(data);
    } catch (e) {
      console.error("Favorites fetch failed:", e);
    }
  }, []);

  const addFavorite = useCallback(async (item) => {
    const shopIds = Array.isArray(item?.shop)
      ? item.shop.map((s) => (typeof s === "string" ? s : s?._id)).filter(Boolean)
      : [];
    const updated = await api.addFavorite({ text: item?.text, shop: shopIds });
    setItems(updated);
  }, []);

  const updateFavorite = useCallback(async (itemId, updates) => {
    const updated = await api.updateFavorite(itemId, updates);
    setItems(updated);
  }, []);

  const deleteFavorite = useCallback(async (itemOrId) => {
    const id = typeof itemOrId === "string" ? itemOrId : itemOrId?._id;
    if (!id) return;
    const updated = await api.deleteFavorite(id);
    setItems(updated);
  }, []);

  // Called when a shop is deleted - removes it from local favorites state
  // without an extra API call (the shop was already deleted by ShoppingContext)
  const removeShopFromItems = useCallback((shopId) => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        shop: (item.shop || []).filter((s) => String(s._id) !== String(shopId)),
      })),
    );
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  return (
    <FavoritesContext.Provider
      value={{
        items,
        addFavorite,
        updateFavorite,
        deleteFavorite,
        removeShopFromItems,
        refresh: fetchFavorites,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
