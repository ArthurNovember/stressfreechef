import React from "react";
import { useState } from "react";
import "./ShoppingList.css";
import { Link } from "react-router-dom";

const [isDripdownOpenFavoriteList, setIsDropdownOpenFavoriteList] =
  useState(false);

const sortedItems = [...filteredItems];

if (sortMode === "shop") {
  sortedItems.sort((a, b) => {
    const aNoShop = a.shop.length === 0;
    const bNoShop = b.shop.length === 0;

    if (aNoShop && !bNoShop) return 1;
    if (!aNoShop && bNoShop) return -1;

    if (!aNoShop && !bNoShop) {
      const aFirstShop = a.shop[0];
      const bFirstShop = b.shop[0];
      return aFirstShop.localeCompare(bFirstShop);
    }

    return 0;
  });
}
