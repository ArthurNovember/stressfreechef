import React from "react";
import { useState, useRef, useEffect } from "react";
import "./ShoppingList.css";
import { Link } from "react-router-dom";

const ShoppingList = ({
  text,
  setText,
  shop,
  setShop,
  newItem,
  setNewItem,
  addItem,
  id,
  addFavoriteItem,
  FavoriteNewItem,
  deleteFavoriteItem,
  shopOptions,
  setShopOptions,
  uniqueItemNames,
  updateShoppingItem,
  deleteShoppingItem,
}) => {
  const hasToken = !!localStorage.getItem("token");

  //zavření dropdownů
  const dropdownRefs = useRef({});
  const inputDropdownRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (e) => {
      const clickedInsideInput =
        inputDropdownRef.current && inputDropdownRef.current.contains(e.target);

      const clickedInsideAnyRow = Object.values(dropdownRefs.current).some(
        (node) => node && node.contains(e.target)
      );

      if (!clickedInsideInput && !clickedInsideAnyRow) {
        setIsDropdownOpenInput(false);
        setIsDropDownOpen({});
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  //

  const handleTextChange = (event) => {
    setText(event.target.value);
  };
  const handleShopChange = (event) => {
    setShop(event.target.value);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    addItem({ text: text, shop: shop });
    setText("");
  };

  const deleteItem = async (itemId) => {
    await deleteShoppingItem(itemId);
  };

  const [obrazek, setObrazek] = useState("https://i.imgur.com/DmXZvGl.png");

  const handleToggleShop = async (itemId, shopId) => {
    const item = newItem.find((i) => i._id === itemId);
    if (!item) return;

    const shopAlreadySelected = item.shop.some(
      (s) => String(s._id) === String(shopId)
    );

    const updatedShops = shopAlreadySelected
      ? item.shop
          .filter((s) => String(s._id) !== String(shopId))
          .map((s) => s._id)
      : [...item.shop.map((s) => s._id), shopId];

    await updateShoppingItem(itemId, { shop: updatedShops });
  };

  const [addingShop, setAddingShop] = useState(false);
  const [newShopName, setNewShopName] = useState("");

  const handleDeleteShop = async (shopToDeleteId) => {
    try {
      const token = localStorage.getItem("token");

      await fetch(
        `https://stressfreecheff-backend.onrender.com/api/shopping-list/shop-options/${shopToDeleteId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // 🧼 Lokálně taky smaž (aby se UI hned aktualizovalo)
      setShopOptions((prev) => prev.filter((s) => s._id !== shopToDeleteId));
      setNewItem((prevItems) =>
        prevItems.map((item) => ({
          ...item,
          shop: item.shop.filter((s) => s._id !== shopToDeleteId),
        }))
      );
    } catch (err) {
      console.error("Chyba při mazání shopu:", err);
    }
  };

  const [isDropdownOpen, setIsDropDownOpen] = useState({});

  const ToggleDropDown = (index) => {
    setIsDropDownOpen((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const [isDropdownOpenInput, setIsDropdownOpenInput] = useState(false);

  //Filtrování
  const [filterShops, setFilterShops] = useState([]);

  const filteredItems = newItem.filter((item) => {
    if (filterShops.length === 0) return true;

    const hasShopMatch = item.shop.some((s) => filterShops.includes(s._id));
    const isNoShop = item.shop.length === 0 && filterShops.includes("No Shop");

    return hasShopMatch || isNoShop;
  });

  //Řazení

  const [sortMode, setSortMode] = useState("added");
  const sortedItems = [...filteredItems];

  if (sortMode === "shop") {
    sortedItems.sort((a, b) => {
      const aNoShop = a.shop.length === 0;
      const bNoShop = b.shop.length === 0;

      if (aNoShop && !bNoShop) return 1;
      if (!aNoShop && bNoShop) return -1;

      if (!aNoShop && !bNoShop) {
        const aFirstShopName = a.shop[0].name || ""; // fallback pokud není
        const bFirstShopName = b.shop[0].name || "";
        return aFirstShopName.localeCompare(bFirstShopName);
      }

      return 0;
    });
  }

  //checkbox
  const toggleChecked = async (_id, currentChecked) => {
    const newChecked = !currentChecked;
    await updateShoppingItem(_id, { checked: newChecked });
  };

  return (
    <div className="celek">
      <div className="filterAndShoppingList">
        {hasToken && (
          <div className="filterAndSort">
            <div className="filterShops">
              <div className="filter-buttons">
                <button
                  className={`filter-btn ${
                    filterShops.length === 0 ? "active" : ""
                  }`}
                  onClick={() => setFilterShops([])}
                >
                  All
                </button>

                {shopOptions.map((shop) => {
                  const active = filterShops.includes(shop._id);
                  return (
                    <button
                      key={shop._id}
                      className={`filter-btn ${active ? "active" : ""}`}
                      onClick={() => {
                        setFilterShops((prev) =>
                          active
                            ? prev.filter((id) => id !== shop._id)
                            : [...prev, shop._id]
                        );
                      }}
                    >
                      {shop.name}
                    </button>
                  );
                })}

                <button
                  className={`filter-btn ${
                    filterShops.includes("No Shop") ? "active" : ""
                  }`}
                  onClick={() => {
                    setFilterShops((prev) =>
                      prev.includes("No Shop")
                        ? prev.filter((id) => id !== "No Shop")
                        : [...prev, "No Shop"]
                    );
                  }}
                >
                  No Shop
                </button>
              </div>
            </div>

            <div className="imgtext">
              <Link to="/favoriteItems">
                <img
                  src={obrazek}
                  onMouseEnter={() =>
                    setObrazek("https://i.imgur.com/PwVAgWN.png")
                  }
                  onMouseLeave={() =>
                    setObrazek("https://i.imgur.com/DmXZvGl.png")
                  }
                ></img>
              </Link>
            </div>
          </div>
        )}
        <div className="shoppingList">
          <ol>
            <li>
              {" "}
              <form className="addForm" onSubmit={handleSubmit}>
                <input
                  type="text"
                  onChange={handleTextChange}
                  value={text}
                  list="itemSuggestions"
                  className="addInput"
                  placeholder="Add Item..."
                />
                <datalist id="itemSuggestions">
                  {uniqueItemNames.map((itemName, index) => (
                    <option value={itemName} />
                  ))}
                </datalist>
                <div className="nadpisADropdown">
                  {hasToken && (
                    <div className="buttonAndShopsInput" ref={inputDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpenInput((prev) => !prev)}
                        className="showShops"
                      >
                        {shop.length < 1
                          ? "Shops▾"
                          : shop
                              .map((id) => {
                                const found = shopOptions.find(
                                  (s) => String(s._id) === String(id)
                                );
                                return found ? found.name : "Unknown";
                              })
                              .join(", ")}
                      </button>
                      {isDropdownOpenInput && (
                        <ul
                          className="shopCheckboxListInput"
                          style={{ zIndex: 9999 }}
                        >
                          {shopOptions.map(({ _id, name }) => (
                            <li key={_id}>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={shop.includes(_id)}
                                  onChange={() => {
                                    const hasShop = shop.includes(_id);
                                    const updated = hasShop
                                      ? shop.filter((s) => s !== _id)
                                      : [...shop, _id];
                                    setShop(updated);
                                  }}
                                />
                                {name}
                              </label>
                              <button
                                type="button"
                                onClick={() => handleDeleteShop(_id)}
                                className="deleteShop"
                              >
                                ❌
                              </button>
                            </li>
                          ))}
                          <li className="addLi">
                            <button
                              type="button"
                              className="add"
                              onClick={() => setAddingShop((prev) => !prev)}
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
                                onClick={async () => {
                                  const trimmed = newShopName.trim();
                                  if (
                                    trimmed &&
                                    !shopOptions.some(
                                      (shop) => shop.name === trimmed
                                    )
                                  ) {
                                    const response = await fetch(
                                      "https://stressfreecheff-backend.onrender.com/api/shopping-list/shop-options",
                                      {
                                        method: "POST",
                                        headers: {
                                          "Content-Type": "application/json",
                                          Authorization: `Bearer ${localStorage.getItem(
                                            "token"
                                          )}`,
                                        },
                                        body: JSON.stringify({ name: trimmed }),
                                      }
                                    );

                                    const newShop = await response.json();
                                    setShopOptions((prev) => [
                                      ...prev,
                                      newShop,
                                    ]);
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
                  )}
                </div>

                <input className="submit" type="submit" value="Send to list" />
              </form>
            </li>
            {sortedItems.map((item, index) => {
              const favMatch = FavoriteNewItem.find(
                (fav) =>
                  fav.text?.trim().toLowerCase() ===
                  item.text?.trim().toLowerCase()
              );
              const isFavorite = !!favMatch;
              const favoriteId = favMatch?._id; // ← Tohle je ID, které chce backend u DELETE
              const isOpen = isDropdownOpen[index] || false;
              return (
                <li key={item._id || index}>
                  <div className="nameAndCheck">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleChecked(item._id, item.checked)}
                      id={item._id}
                    />
                    <label htmlFor={item._id} className="itemTextLabel">
                      <span
                        className="itemText"
                        style={{
                          color: item.checked ? "grey" : "inherit",
                          textDecoration: item.checked
                            ? "line-through"
                            : "none",
                        }}
                      >
                        <span className="numbering">{index + 1}.</span>{" "}
                        {item.text}
                      </span>
                    </label>
                  </div>
                  <div
                    className="buttonAndShops"
                    ref={(el) => (dropdownRefs.current[index] = el)}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!hasToken) {
                          alert(
                            "Log in to unlock the store assignment feature."
                          );
                          return;
                        }
                        ToggleDropDown(index);
                      }}
                      className="showShops"
                    >
                      <span>
                        {item.shop.length > 0
                          ? item.shop.map((s) => s.name).join(", ")
                          : "Shops▾"}
                      </span>
                    </button>

                    {isOpen && (
                      <ul
                        className="shopCheckboxList"
                        style={{ zIndex: 100 + (newItem.length - index) }}
                      >
                        {shopOptions.map((shop) => (
                          <li key={shop._id}>
                            <label>
                              <input
                                type="checkbox"
                                checked={item.shop.some(
                                  (s) => String(s._id) === String(shop._id)
                                )}
                                onChange={() =>
                                  handleToggleShop(item._id, shop._id)
                                } // ✅ změna tady
                              />

                              {shop.name}
                            </label>
                            <button
                              type="button"
                              onClick={() => handleDeleteShop(shop._id)}
                              className="deleteShop"
                            >
                              ❌
                            </button>
                          </li>
                        ))}

                        <li className="addLi">
                          <button
                            type="button"
                            className="add"
                            onClick={() => setAddingShop((prev) => !prev)}
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
                              onClick={async () => {
                                const trimmed = newShopName.trim();
                                const exists = shopOptions.some(
                                  (s) =>
                                    s.name.toLowerCase() ===
                                    trimmed.toLowerCase()
                                );

                                if (trimmed && !exists) {
                                  const res = await fetch(
                                    "https://stressfreecheff-backend.onrender.com/api/shopping-list/shop-options",
                                    {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                        Authorization: `Bearer ${localStorage.getItem(
                                          "token"
                                        )}`,
                                      },
                                      body: JSON.stringify({ name: trimmed }),
                                    }
                                  );
                                  const newShop = await res.json();
                                  setShopOptions((prev) => [...prev, newShop]);
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

                    <button
                      className="srdce"
                      onClick={() => {
                        if (!hasToken) {
                          alert("Log in to unlock the favorites feature.");
                          return;
                        }
                        if (isFavorite && favoriteId) {
                          // 🗑️ smaž správné favorite _id
                          deleteFavoriteItem(favoriteId);
                        } else {
                          // ➕ přidej do favorites (pošli text + shop IDs)
                          addFavoriteItem({
                            text: item.text,
                            shop: (item.shop || []).map((s) => s._id),
                          });
                        }
                      }}
                      style={{ color: isFavorite ? "Red" : "gray" }}
                    >
                      <i className="fas fa-heart"></i>
                    </button>
                    <button
                      className="deleteItem"
                      onClick={() => {
                        deleteItem(item._id);
                      }}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <div className="addItem"></div>
    </div>
  );
};

export default ShoppingList;
