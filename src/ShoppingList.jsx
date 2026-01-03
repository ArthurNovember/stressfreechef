import React, { useEffect, useRef, useState } from "react";
import "./ShoppingList.css";
import { Link } from "react-router-dom";

/* -----------------------------
   API config
----------------------------- */
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "https://stressfreecheff-backend.onrender.com";

const API = String(API_BASE || "").replace(/\/+$/, "");

/* -----------------------------
   Component
----------------------------- */
const ShoppingList = ({
  text,
  setText,
  shop,
  setShop,
  newItem,
  setNewItem,
  addItem,
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

  /* =============================
     Refs – click outside
  ============================= */
  const dropdownRefs = useRef({});
  const inputDropdownRef = useRef(null);

  /* =============================
     State 
  ============================= */
  const [obrazek, setObrazek] = useState("https://i.imgur.com/DmXZvGl.png");

  const [isDropdownOpen, setIsDropDownOpen] = useState({});
  const [isDropdownOpenInput, setIsDropdownOpenInput] = useState(false);

  const [addingShop, setAddingShop] = useState(false);
  const [newShopName, setNewShopName] = useState("");

  const [filterShops, setFilterShops] = useState([]);
  const [sortMode, setSortMode] = useState("added");

  /* =============================
     Effect – close dropdowns on outside click
  ============================= */
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

  /* =============================
     Handlers
  ============================= */
  const handleTextChange = (event) => {
    setText(event.target.value);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!text.trim()) return;

    addItem({ text: text, shop: shop });
    setText("");
  };

  const deleteItem = async (itemId) => {
    await deleteShoppingItem(itemId);
  };

  const toggleChecked = async (_id, currentChecked) => {
    const newChecked = !currentChecked;
    await updateShoppingItem(_id, { checked: newChecked });
  };

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

  const handleDeleteShop = async (shopToDeleteId) => {
    try {
      const token = localStorage.getItem("token");

      await fetch(`${API}/api/shopping-list/shop-options/${shopToDeleteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

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

  async function handleAddShop() {
    const trimmed = newShopName.trim();
    if (!trimmed) return;

    const exists = shopOptions.some(
      (s) => s.name.toLowerCase() === trimmed.toLowerCase()
    );

    if (exists) {
      setNewShopName("");
      setAddingShop(false);
      return;
    }

    const res = await fetch(`${API}/api/shopping-list/shop-options`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ name: trimmed }),
    });

    const newShop = await res.json();
    setShopOptions((prev) => [...prev, newShop]);

    setNewShopName("");
    setAddingShop(false);
  }

  const ToggleDropDown = (index) => {
    setIsDropDownOpen((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  /* =============================
     Filtering
  ============================= */
  const filteredItems = newItem.filter((item) => {
    if (filterShops.length === 0) return true;

    const hasShopMatch = item.shop.some((s) => filterShops.includes(s._id));
    const isNoShop = item.shop.length === 0 && filterShops.includes("No Shop");

    return hasShopMatch || isNoShop;
  });

  /* =============================
     Sorting
  ============================= */
  const sortedItems = [...filteredItems];

  if (sortMode === "added") {
    sortedItems.reverse();
  }

  if (sortMode === "shop") {
    sortedItems.sort((a, b) => {
      const aNoShop = a.shop.length === 0;
      const bNoShop = b.shop.length === 0;

      if (aNoShop && !bNoShop) return 1;
      if (!aNoShop && bNoShop) return -1;

      if (!aNoShop && !bNoShop) {
        const aFirstShopName = a.shop[0].name || "";
        const bFirstShopName = b.shop[0].name || "";
        return aFirstShopName.localeCompare(bFirstShopName);
      }

      return 0;
    });
  }

  /* =============================
     Render
  ============================= */
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
                  type="button"
                >
                  All
                </button>

                {shopOptions.map((shop) => {
                  const active = filterShops.includes(shop._id);
                  return (
                    <button
                      key={shop._id}
                      className={`filter-btn ${active ? "active" : ""}`}
                      type="button"
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
                  type="button"
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
                  alt="Favorites"
                  onMouseEnter={() =>
                    setObrazek("https://i.imgur.com/PwVAgWN.png")
                  }
                  onMouseLeave={() =>
                    setObrazek("https://i.imgur.com/DmXZvGl.png")
                  }
                />
              </Link>
            </div>
          </div>
        )}

        <div className="shoppingList">
          <ol>
            <li>
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
                    <option key={`${itemName}-${index}`} value={itemName} />
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
                              <button type="button" onClick={handleAddShop}>
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
              const favoriteId = favMatch?._id;

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
                                }
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
                            <button type="button" onClick={handleAddShop}>
                              <span className="addText">+</span>
                            </button>
                          </li>
                        )}
                      </ul>
                    )}

                    <button
                      className="srdce"
                      type="button"
                      onClick={() => {
                        if (!hasToken) {
                          alert("Log in to unlock the favorites feature.");
                          return;
                        }
                        if (isFavorite && favoriteId) {
                          deleteFavoriteItem(favoriteId);
                        } else {
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
                      type="button"
                      onClick={() => deleteItem(item._id)}
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
