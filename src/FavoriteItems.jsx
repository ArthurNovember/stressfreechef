import { useState, useEffect, useRef } from "react";
import "./FavoriteItems.css";

/* -----------------------------
   API config
----------------------------- */
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "https://stressfreecheff-backend.onrender.com";

/* -----------------------------
   Component
----------------------------- */
const FavoriteItems = ({
  FavoriteNewItem,
  setFavoriteNewItem,
  FavoriteText,
  setFavoriteText,
  handleFavoriteText,
  FavoriteShop,
  setFavoriteShop,
  addFavoriteItem,
  addItem,
  deleteFavoriteItem,
  shopOptions,
  setShopOptions,
  uniqueItemNames,
  updateFavoriteItem,
}) => {
  /* =============================
     Refs – dropdown outside click
  ============================= */
  const topDropdownRef = useRef(null);
  const rowDropdownRefs = useRef({});

  /* =============================
     States 
  ============================= */
  const [isDropdownOpenTop, setIsDropdownOpenTop] = useState(false);
  const [rowDropdownOpen, setRowDropdownOpen] = useState({});
  const [addingShop, setAddingShop] = useState(false);
  const [newShopName, setNewShopName] = useState("");

  const [filterShopsFavorite, setFilterShopsFavorite] = useState([]);
  const [sortModeFavorite, setSortModeFavorite] = useState("added");

  /* =============================
     Effects
  ============================= */
  useEffect(() => {
    const handleClickOutside = (e) => {
      const clickedTop = topDropdownRef.current?.contains(e.target);

      const clickedRow = Object.values(rowDropdownRefs.current).some(
        (node) => node && node.contains(e.target)
      );

      if (!clickedTop && !clickedRow) {
        setIsDropdownOpenTop(false);
        setRowDropdownOpen({});
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* =============================
     Handlers 
  ============================= */
  function handleSubmit(e) {
    e.preventDefault();
    if (!FavoriteText.trim()) return;

    const uniqueIds = [...new Set(FavoriteShop)];
    addFavoriteItem({ text: FavoriteText, shop: uniqueIds });

    setFavoriteText("");
    setFavoriteShop([]);
  }

  function toggleRowDropdown(index) {
    setRowDropdownOpen((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  }

  async function handleDeleteShop(shopId) {
    try {
      await fetch(`${API_BASE}/api/shopping-list/shop-options/${shopId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      setShopOptions((prev) =>
        prev.filter((s) => String(s._id) !== String(shopId))
      );

      setFavoriteNewItem((prev) =>
        prev.map((item) => ({
          ...item,
          shop: (item.shop || []).filter(
            (s) => String(s._id) !== String(shopId)
          ),
        }))
      );

      setFavoriteShop((prev) =>
        prev.filter((id) => String(id) !== String(shopId))
      );
    } catch (err) {
      console.error("Failed to delete shop:", err);
    }
  }

  function handleToggleShop(itemId, currentShops, shopId) {
    const currentIds = (currentShops || []).map((s) =>
      typeof s === "string" ? s : s._id
    );

    const exists = currentIds.some((id) => String(id) === String(shopId));

    const nextIds = exists
      ? currentIds.filter((id) => String(id) !== String(shopId))
      : [...currentIds, shopId];

    updateFavoriteItem(itemId, { shop: nextIds });
  }

  async function handleAddShop() {
    const trimmed = newShopName.trim();
    if (!trimmed) return;

    if (shopOptions.some((s) => s.name === trimmed)) {
      setNewShopName("");
      setAddingShop(false);
      return;
    }

    const res = await fetch(`${API_BASE}/api/shopping-list/shop-options`, {
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

  /* =============================
    Filtering
  ============================= */
  const filteredItems = FavoriteNewItem.filter((item) => {
    if (filterShopsFavorite.length === 0) return true;

    const hasShop = (item.shop || []).some((s) =>
      filterShopsFavorite.includes(s._id)
    );

    const noShop =
      (item.shop || []).length === 0 && filterShopsFavorite.includes("No Shop");

    return hasShop || noShop;
  });

  /* =============================
     Sorting
  ============================= */
  const sortedItems = [...filteredItems];

  if (sortModeFavorite === "shop") {
    sortedItems.sort((a, b) => {
      const aHas = (a.shop || []).length > 0;
      const bHas = (b.shop || []).length > 0;

      if (!aHas && bHas) return 1;
      if (aHas && !bHas) return -1;
      if (!aHas && !bHas) return 0;

      const getName = (item) => {
        const first = item.shop[0];
        if (typeof first === "string") {
          return (
            shopOptions.find((s) => String(s._id) === String(first))?.name || ""
          );
        }
        return first?.name || "";
      };

      return getName(a).localeCompare(getName(b));
    });
  }

  /* =============================
     Render
  ============================= */
  return (
    <div className="FavoriteCelek">
      <div className="itemContainer">
        <h2>MY FAVORITES</h2>

        <div className="favoriteSelectAndSort">
          <div className="filterShopsFavorite">
            <p>Shop:</p>

            {shopOptions.map(({ _id, name }) => (
              <label key={_id}>
                <input
                  type="checkbox"
                  checked={filterShopsFavorite.includes(_id)}
                  onChange={() =>
                    setFilterShopsFavorite((prev) =>
                      prev.includes(_id)
                        ? prev.filter((s) => s !== _id)
                        : [...prev, _id]
                    )
                  }
                />
                {name}
              </label>
            ))}

            <label className="noShop">
              <input
                type="checkbox"
                checked={filterShopsFavorite.includes("No Shop")}
                onChange={() =>
                  setFilterShopsFavorite((prev) =>
                    prev.includes("No Shop")
                      ? prev.filter((s) => s !== "No Shop")
                      : [...prev, "No Shop"]
                  )
                }
              />
              No Shop
            </label>
          </div>
        </div>

        <div className="ItemButton">
          <ul>
            <li>
              <form onSubmit={handleSubmit}>
                <div className="AddTopFavorite">
                  <input
                    type="text"
                    className="writeFavorite"
                    onChange={handleFavoriteText}
                    value={FavoriteText}
                    list="itemSuggestions"
                    placeholder="Add favorite item…"
                  />

                  <datalist id="itemSuggestions">
                    {uniqueItemNames.map((name, i) => (
                      <option key={`${name}-${i}`} value={name} />
                    ))}
                  </datalist>

                  <div className="TopAddShop">
                    <div className="buttonAndShopsInput" ref={topDropdownRef}>
                      <button
                        type="button"
                        className="showShopsInput"
                        onClick={() => setIsDropdownOpenTop((p) => !p)}
                      >
                        {FavoriteShop.length < 1
                          ? "Shops▾"
                          : FavoriteShop.map((id) => {
                              const found = shopOptions.find(
                                (s) => String(s._id) === String(id)
                              );
                              return found ? found.name : "Unknown";
                            }).join(", ")}
                      </button>

                      {isDropdownOpenTop && (
                        <ul className="shopCheckboxListInput">
                          {shopOptions.map(({ _id, name }) => (
                            <li key={_id}>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={FavoriteShop.includes(_id)}
                                  onChange={() =>
                                    setFavoriteShop((prev) =>
                                      prev.includes(_id)
                                        ? prev.filter((s) => s !== _id)
                                        : [...prev, _id]
                                    )
                                  }
                                />
                                {name}
                              </label>
                              <button
                                type="button"
                                onClick={() => handleDeleteShop(_id)}
                              >
                                ❌
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <button className="addButtonTop" type="submit">
                      ADD
                    </button>
                  </div>
                </div>
              </form>
            </li>

            {sortedItems.map((item, index) => {
              const isOpen = rowDropdownOpen[index] || false;

              return (
                <li key={item._id}>
                  <span className="itemName">
                    <span className="numbering">{index + 1}</span>. {item.text}
                  </span>

                  <div>
                    <div
                      className="buttonAndShops"
                      ref={(el) => (rowDropdownRefs.current[index] = el)}
                    >
                      <button
                        type="button"
                        className="showShops"
                        onClick={() => toggleRowDropdown(index)}
                      >
                        {item.shop.length > 0
                          ? item.shop.map((s) => s.name).join(", ")
                          : "Shops▾"}
                      </button>

                      {isOpen && (
                        <ul
                          className="shopCheckboxList"
                          style={{
                            zIndex: 100 + (FavoriteNewItem.length - index),
                          }}
                        >
                          {shopOptions.map((shop) => (
                            <li key={shop._id}>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={(item.shop || []).some(
                                    (s) => String(s._id) === String(shop._id)
                                  )}
                                  onChange={() =>
                                    handleToggleShop(
                                      item._id,
                                      item.shop,
                                      shop._id
                                    )
                                  }
                                />
                                {shop.name}
                              </label>
                              <button
                                type="button"
                                onClick={() => handleDeleteShop(shop._id)}
                              >
                                ❌
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <button
                      className="addButton"
                      onClick={() =>
                        addItem({
                          text: item.text,
                          shop: (item.shop || []).map((s) => s._id),
                        })
                      }
                    >
                      ADD TO SHOPPING LIST
                    </button>

                    <button onClick={() => deleteFavoriteItem(item)}>
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
