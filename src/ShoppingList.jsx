import React from "react";
import { useState } from "react";
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

  const deleteItem = async (index) => {
    await deleteShoppingItem(index);
  };

  const [obrazek, setObrazek] = useState("https://i.imgur.com/DmXZvGl.png");

  const handleToggleShop = async (index, shop) => {
    const item = newItem[index];
    const hasShop = item.shop.includes(shop);
    const updatedShop = hasShop
      ? item.shop.filter((s) => s !== shop)
      : [...item.shop, shop];

    await updateShoppingItem(index, { shop: updatedShop });
  };

  const [addingShop, setAddingShop] = useState(false);
  const [newShopName, setNewShopName] = useState("");

  const handleDeleteShop = (shopToDelete) => {
    setShopOptions((prev) => prev.filter((s) => s !== shopToDelete));
    setNewItem((prevItems) =>
      prevItems.map((item) => ({
        ...item,
        shop: item.shop.filter((s) => s !== shopToDelete),
      }))
    );
  };

  const [isDropdownOpen, setIsDropDownOpen] = useState({});

  const ToggleDropDown = (index) => {
    setIsDropDownOpen((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const [isDropdownOpenInput, setIsDropdownOpenInput] = useState(false);

  //Filtrování
  const [filterShops, setFilterShops] = useState([]);

  const filteredItems = newItem.filter((item) => {
    if (filterShops.length === 0) {
      return true;
    }
    const hasShopMatch = item.shop.some((s) => filterShops.includes(s));
    const isNoShop = item.shop.length === 0 && filterShops.includes("No Shop");
    if (hasShopMatch === true || isNoShop === true) {
      return true;
    } else {
      return false;
    }
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
        const aFirstShop = a.shop[0];
        const bFirstShop = b.shop[0];
        return aFirstShop.localeCompare(bFirstShop);
      }

      return 0;
    });
  }

  //checkbox
  const toggleChecked = async (itemText, index) => {
    const newChecked = !newItem[index].checked;
    await updateShoppingItem(index, { checked: newChecked });
  };

  return (
    <div className="celek">
      <div className="filterAndShoppingList">
        <div className="filterAndSort">
          <div className="filterShops">
            <h3>Shop:</h3>
            {shopOptions.map((shopName, i) => (
              <label key={i}>
                <input
                  type="checkbox"
                  checked={filterShops.includes(shopName)}
                  onChange={() => {
                    setFilterShops((prev) =>
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
                checked={filterShops.includes("No Shop")}
                onChange={() => {
                  setFilterShops((prev) =>
                    prev.includes("No Shop")
                      ? prev.filter((s) => s !== "No Shop")
                      : [...prev, "No Shop"]
                  );
                }}
              />
              No Shop
            </label>
          </div>

          <div className="sortSelector">
            <label>Sort by:</label>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
            >
              <option value="added">Added</option>
              <option value="shop">Shop</option>
            </select>
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
                  <div className="buttonAndShopsInput">
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpenInput((prev) => !prev)}
                      className="showShops"
                    >
                      {shop.length < 1 ? "Shops▾" : shop.join(", ")}
                    </button>
                    {isDropdownOpenInput && (
                      <ul
                        className="shopCheckboxListInput"
                        style={{ zIndex: 9999 }}
                      >
                        {shopOptions.map((shopName, i) => (
                          <li key={i}>
                            <label>
                              <input
                                type="checkbox"
                                checked={shop.includes(shopName)}
                                onChange={() => {
                                  const hasShop = shop.includes(shopName);
                                  const updated = hasShop
                                    ? shop.filter((s) => s !== shopName)
                                    : [...shop, shopName];
                                  setShop(updated);
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
                              onClick={async () => {
                                const trimmed = newShopName.trim();
                                if (trimmed && !shopOptions.includes(trimmed)) {
                                  const updatedShops = [
                                    ...shopOptions,
                                    trimmed,
                                  ];
                                  setShopOptions(updatedShops);

                                  // 🎯 PATCH na server
                                  await fetch(
                                    "https://stressfreecheff-backend.onrender.com/api/shopping-list/shop-options",
                                    {
                                      method: "PATCH",
                                      headers: {
                                        "Content-Type": "application/json",
                                        Authorization: `Bearer ${localStorage.getItem(
                                          "token"
                                        )}`,
                                      },
                                      body: JSON.stringify(updatedShops),
                                    }
                                  );
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
                </div>

                <input className="submit" type="submit" value="Send to list" />
              </form>
            </li>
            {sortedItems.map((item, index) => {
              const isFavorite = FavoriteNewItem.some(
                (fav) => fav.text === item.text
              );
              const isOpen = isDropdownOpen[index] || false;
              return (
                <li key={index}>
                  <label>
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleChecked(item.text, index)}
                    />
                    <span
                      className="itemText"
                      style={{
                        color: item.checked ? "grey" : "inherit",
                        textDecoration: item.checked ? "line-through" : "none",
                      }}
                    >
                      <span className="numbering">{index + 1}.</span>{" "}
                      {item.text}
                    </span>
                  </label>

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
                        style={{ zIndex: 100 + (newItem.length - index) }}
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
                  <button
                    className="srdce"
                    onClick={() => {
                      if (isFavorite) {
                        deleteFavoriteItem(item);
                      } else {
                        addFavoriteItem(item);
                      }
                    }}
                    style={{ color: isFavorite ? "Red" : "gray" }}
                  >
                    <i className="fas fa-heart"></i>
                  </button>
                  <button
                    className="deleteItem"
                    onClick={() => {
                      deleteItem(index);
                    }}
                  >
                    <i class="fas fa-times"></i>
                  </button>
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
