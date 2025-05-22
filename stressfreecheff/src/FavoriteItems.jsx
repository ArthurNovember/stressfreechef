import React from "react";
import { useState } from "react";
import "./FavoriteItems.css";

const FavoriteItems = ({
  FavoriteNewItem,
  setFavoriteNewItem,
  FavoriteText,
  setFavoriteText,
  handleFavoriteText,
  FavoriteShop,
  setFavoriteShop,
  handleFavoriteShop,
  addFavoriteItem,
  addItem,
  deleteFavoriteItem,
  shopOptions,
  setShopOptions,
  ShopOptions,
  uniqueItemNames,
}) => {
  //funkce, co se spustí po submitu
  const handleSubmit = (event) => {
    event.preventDefault();
    addFavoriteItem({ text: FavoriteText, shop: FavoriteShop });
    setFavoriteText("");
  };
  const [isDropdownOpenFavorite, setIsDropdownOpenFavorite] = useState(false);
  const [addingShop, setAddingShop] = useState(false);
  const [newShopName, setNewShopName] = useState("");
  const handleDeleteShop = (shopToDelete) => {
    setShopOptions((prev) => prev.filter((s) => s !== shopToDelete));
    setFavoriteNewItem((prevItems) =>
      prevItems.map((item) => ({
        ...item,
        shop: item.shop.filter((s) => s !== shopToDelete),
      }))
    );
  };

  const handleToggleShop = (index, shop) => {
    setFavoriteNewItem((prevItems) =>
      prevItems.map((item, i) => {
        if (i !== index) return item;

        const hasShop = item.shop.includes(shop);
        const updatedShop = hasShop
          ? item.shop.filter((s) => s !== shop)
          : [...item.shop, shop];

        return { ...item, shop: updatedShop };
      })
    );
  };

  const [isDropdownOpen, setIsDropDownOpen] = useState({});

  const ToggleDropDown = (index) => {
    setIsDropDownOpen((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  //Filtrování
  const [filterShopsFavorite, setFilterShopsFavorite] = useState([]);

  const filteredItemsFavorite = FavoriteNewItem.filter((item) => {
    if (filterShopsFavorite.length === 0) {
      return true;
    }
    const hasShopMatch = item.shop.some((s) => filterShopsFavorite.includes(s));
    const isNoShop =
      item.shop.length === 0 && filterShopsFavorite.includes("No Shop");
    if (hasShopMatch === true || isNoShop === true) {
      return true;
    } else {
      return false;
    }
  });

  //Řazení

  const [sortModeFavorite, setSortModeFavorite] = useState("added");
  const sortedItemsFavorite = [...filteredItemsFavorite];

  if (sortModeFavorite === "shop") {
    sortedItemsFavorite.sort((a, b) => {
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

  return (
    <div className="FavoriteCelek">
      <form onSubmit={handleSubmit}>
        <div className="topAdd">
          <h1>Add To Favorite</h1>
          <input
            type="text"
            className="writeFavorite"
            onChange={handleFavoriteText}
            value={FavoriteText}
            list="itemSuggestions"
          ></input>

          <datalist id="itemSuggestions">
            {uniqueItemNames.map((itemName, index) => (
              <option value={itemName} />
            ))}
          </datalist>
        </div>
        <div className="TopAddShop">
          <h2>Select Shop (optional)</h2>

          <div className="buttonAndShopsInput">
            <button
              type="button"
              onClick={() => setIsDropdownOpenFavorite((prev) => !prev)}
              className="showShopsInput"
            >
              {FavoriteShop.length < 1 ? "Shops▾" : FavoriteShop.join(", ")}
            </button>
            {isDropdownOpenFavorite && (
              <ul className="shopCheckboxListInput" style={{ zIndex: 9999 }}>
                {shopOptions.map((shopName, i) => (
                  <li key={i}>
                    <label>
                      <input
                        type="checkbox"
                        checked={FavoriteShop.includes(shopName)}
                        onChange={() => {
                          const hasShop = FavoriteShop.includes(shopName);
                          const updated = hasShop
                            ? FavoriteShop.filter((s) => s !== shopName)
                            : [...FavoriteShop, shopName];
                          setFavoriteShop(updated);
                        }}
                      ></input>
                      {shopName}
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDeleteShop(shopName)}
                    >
                      ❌
                    </button>
                  </li>
                ))}
                <li className="addLi">
                  <button
                    type="button"
                    className="add"
                    onClick={() =>
                      addingShop ? setAddingShop(false) : setAddingShop(true)
                    }
                  >
                    Add Shop
                  </button>
                </li>
                {addingShop && (
                  <li>
                    <input
                      type="text"
                      placeholder="New Shop"
                      value={newShopName}
                      onChange={(e) => setNewShopName(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = newShopName.trim();
                        if (trimmed && !shopOptions.includes(trimmed)) {
                          setShopOptions([...shopOptions, trimmed]);
                        }
                        setNewShopName("");
                        setAddingShop(false);
                      }}
                    >
                      <span className="addText">+</span>
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>

          <button className="addButtonTop">ADD</button>
        </div>
      </form>

      <div className="itemContainer">
        <h2>My favorites</h2>
        <div className="favoriteSelectAndSort">
          <div className="filterShopsFavorite">
            <p>Shop:</p>
            {shopOptions.map((shopName, i) => (
              <label key={i}>
                <input
                  type="checkbox"
                  checked={filterShopsFavorite.includes(shopName)}
                  onChange={() => {
                    setFilterShopsFavorite((prev) =>
                      prev.includes(shopName)
                        ? prev.filter((s) => s !== shopName)
                        : [...prev, shopName]
                    );
                  }}
                />
                {shopName}
              </label>
            ))}
            <label className="noShop">
              <input
                type="checkbox"
                checked={filterShopsFavorite.includes("No Shop")}
                onChange={() => {
                  setFilterShopsFavorite((prev) =>
                    prev.includes("No Shop")
                      ? prev.filter((s) => s !== "No Shop")
                      : [...prev, "No Shop"]
                  );
                }}
              />
              No Shop
            </label>
          </div>
          <div className="sort">
            <label>Sort by:</label>
            <select
              value={sortModeFavorite}
              onChange={(e) => setSortModeFavorite(e.target.value)}
            >
              <option value="added">Added</option>
              <option value="shop">Shop</option>
            </select>
          </div>
        </div>
        <div className="ItemButton">
          <ul>
            {sortedItemsFavorite.map((item, index) => {
              const isOpen = isDropdownOpen[index] || false;
              return (
                <li>
                  <span className="itemName">
                    <span className="numbering">{index + 1}</span>. {item.text}
                  </span>{" "}
                  <div>
                    <div className="buttonAndShops">
                      <button
                        type="button"
                        onClick={() => ToggleDropDown(index)}
                        className="showShops"
                      >
                        <span>
                          {item.shop.length > 0
                            ? ` ${item.shop.join(", ")}`
                            : "Shops▾"}
                        </span>
                      </button>
                      {isOpen && (
                        <ul
                          className="shopCheckboxList"
                          style={{
                            zIndex: 100 + (FavoriteNewItem.length - index),
                          }}
                        >
                          {shopOptions.map((shop, i) => (
                            <li key={i}>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={item.shop.includes(shop)}
                                  onChange={() => handleToggleShop(index, shop)}
                                ></input>
                                {shop}
                              </label>
                              <button
                                type="button"
                                onClick={() => handleDeleteShop(shop)}
                              >
                                ❌
                              </button>
                            </li>
                          ))}
                          <li className="addLi">
                            <button
                              type="button"
                              className="add"
                              onClick={() =>
                                addingShop
                                  ? setAddingShop(false)
                                  : setAddingShop(true)
                              }
                            >
                              Add Shop
                            </button>
                          </li>
                          {addingShop && (
                            <li>
                              <input
                                type="text"
                                placeholder="New Shop"
                                value={newShopName}
                                onChange={(e) => setNewShopName(e.target.value)}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const trimmed = newShopName.trim();
                                  if (
                                    trimmed &&
                                    !shopOptions.includes(trimmed)
                                  ) {
                                    setShopOptions([...shopOptions, trimmed]);
                                  }
                                  setNewShopName("");
                                  setAddingShop(false);
                                }}
                              >
                                <span className="addText">+</span>
                              </button>
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                    <button className="addButton" onClick={() => addItem(item)}>
                      ADD TO SHOPPING LIST
                    </button>
                    <button
                      onClick={() => {
                        deleteFavoriteItem(item);
                      }}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FavoriteItems;
