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
  addFavoriteItem,
  addItem,
  deleteFavoriteItem,
  shopOptions,
  setShopOptions,
  uniqueItemNames,
  updateFavoriteItem,
}) => {
  //funkce, co se spustí po submitu
  const handleSubmit = (e) => {
    e.preventDefault();
    const uniqueIds = [...new Set(FavoriteShop)]; // FavoriteShop = pole _id
    addFavoriteItem({ text: FavoriteText, shop: uniqueIds });
    setFavoriteText("");
    setFavoriteShop([]);
  };

  const [isDropdownOpenFavorite, setIsDropdownOpenFavorite] = useState(false);
  const [addingShop, setAddingShop] = useState(false);
  const [newShopName, setNewShopName] = useState("");

  const handleDeleteShop = async (shopToDeleteId) => {
    try {
      await fetch(
        `https://stressfreecheff-backend.onrender.com/api/shopping-list/shop-options/${shopToDeleteId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
      // UI update:
      setShopOptions((prev) =>
        prev.filter((s) => String(s._id) !== String(shopToDeleteId))
      );
      setFavoriteNewItem((prev) =>
        prev.map((item) => ({
          ...item,
          shop: (item.shop || []).filter(
            (s) => String(s._id) !== String(shopToDeleteId)
          ),
        }))
      );
      setFavoriteShop((prev) =>
        prev.filter((id) => String(id) !== String(shopToDeleteId))
      );
    } catch (err) {
      console.error("Chyba při mazání shopu:", err);
    }
  };

  const handleToggleShop = (index, shopId) => {
    const item = FavoriteNewItem[index];
    const currentIds = (item.shop || []).map((s) => s._id);
    const has = currentIds.some((id) => String(id) === String(shopId));
    const nextIds = has
      ? currentIds.filter((id) => String(id) !== String(shopId))
      : [...currentIds, shopId];

    updateFavoriteItem(item._id, { shop: nextIds });
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
    const hasShopMatch = item.shop.some((s) =>
      filterShopsFavorite.includes(s._id)
    );
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
      const aFirstShopName = a.shop[0].name || "";
      const bFirstShopName = b.shop[0].name || "";

      if (aNoShop && !bNoShop) return 1;
      if (!aNoShop && bNoShop) return -1;

      if (!aNoShop && !bNoShop) {
        const aFirstShop = a.shop[0];
        const bFirstShop = b.shop[0];
        return aFirstShopName.localeCompare(bFirstShopName);
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
              <option value={itemName} key={index} />
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
              {FavoriteShop.length < 1
                ? "Shops▾"
                : FavoriteShop.map((id) => {
                    const found = shopOptions.find(
                      (s) => String(s._id) === String(id)
                    );
                    return found ? found.name : "Unknown";
                  }).join(", ")}
            </button>
            {isDropdownOpenFavorite && (
              <ul className="shopCheckboxListInput" style={{ zIndex: 9999 }}>
                {shopOptions.map(({ _id, name }) => (
                  <li key={_id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={FavoriteShop.includes(_id)}
                        onChange={() => {
                          setFavoriteShop((prev) =>
                            prev.includes(_id)
                              ? prev.filter((s) => s !== _id)
                              : [...prev, _id]
                          );
                        }}
                      />
                      {name}
                    </label>
                    <button type="button" onClick={() => handleDeleteShop(_id)}>
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
                        if (
                          trimmed &&
                          !shopOptions.some((s) => s.name === trimmed)
                        ) {
                          (async () => {
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
                            const newShop = await response.json(); // { _id, name }
                            setShopOptions((prev) => [...prev, newShop]);
                          })();
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
            {shopOptions.map(({ _id, name }) => (
              <label key={_id}>
                <input
                  type="checkbox"
                  checked={filterShopsFavorite.includes(_id)}
                  onChange={() => {
                    setFilterShopsFavorite((prev) =>
                      prev.includes(_id)
                        ? prev.filter((s) => s !== _id)
                        : [...prev, _id]
                    );
                  }}
                />
                {name}
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
                            ? ` ${item.shop.map((s) => s.name).join(", ")}`
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
                          {shopOptions.map((shop) => (
                            <li key={shop._id}>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={(item.shop || []).some(
                                    (s) => String(s._id) === String(shop._id)
                                  )}
                                  onChange={() =>
                                    handleToggleShop(index, shop._id)
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
                                    !shopOptions.some((s) => s.name === trimmed)
                                  ) {
                                    (async () => {
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
                                          body: JSON.stringify({
                                            name: trimmed,
                                          }),
                                        }
                                      );
                                      const newShop = await response.json();
                                      setShopOptions((prev) => [
                                        ...prev,
                                        newShop,
                                      ]);
                                    })();
                                  }
                                }}
                              >
                                <span className="addText">+</span>
                              </button>
                            </li>
                          )}
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
