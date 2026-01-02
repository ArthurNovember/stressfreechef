import { useState, useEffect } from "react";

import "./App.css";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import ShoppingList from "./ShoppingList";
import Home from "./Home";
import FavoriteItems from "./FavoriteItems";
import Recipe from "./Recipe";
import ExploreRecipes from "./exploreRecipes";
import MyRecipes from "./MyRecipes";
import NewRecipe from "./NewRecipe";
import AuthForm from "./AuthForm";
import MyProfile from "./MyProfile";

function App() {
  const [userInfo, setUserInfo] = useState(null); // 🎯 přidat stav pro uživatele
  const token = localStorage.getItem("token");

  // ---- LocalStorage fallback pro shopping list (offline / nepřihlášený uživatel)
  const LOCAL_KEY = "sfc_shoppingList";

  const loadLocalList = () => {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
    } catch {
      return [];
    }
  };

  const saveLocalList = (list) => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  };

  const genLocalId = () =>
    String(Date.now()) + "_" + Math.random().toString(16).slice(2);
  //

  // 🧠 ověření tokenu
  const verifyTokenAndSetUserInfo = async () => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const response = await fetch(
          "https://stressfreecheff-backend.onrender.com/api/profile",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        const data = await response.json();
        if (response.ok) {
          setUserInfo(data.user);
        } else {
          localStorage.removeItem("token");
          setUserInfo(null);
        }
      } catch (err) {
        console.error("Chyba při ověřování tokenu:", err);
        setUserInfo(null);
      }
    }
  };

  useEffect(() => {
    verifyTokenAndSetUserInfo(); // volá jednotnou funkci
  }, []);

  //Shoppy
  const [shopOptions, setShopOptions] = useState([]);

  const fetchShopOptions = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setShopOptions([]);
      return;
    } // guard pro nepřihlášené

    try {
      const res = await fetch(
        "https://stressfreecheff-backend.onrender.com/api/shopping-list/shop-options",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(await res.text());
      setShopOptions(await res.json());
    } catch (e) {
      console.error("Shop options FAIL:", e);
    }
  };

  useEffect(() => {
    fetchShopOptions(); // jen jednou
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const [displayRecipes, setDisplayRecipes] = useState([]);
  const [recipes, setRecipes] = useState([]); // ✅ přidat tento stav

  // Změň useEffect:
  useEffect(() => {
    fetch("https://stressfreecheff-backend.onrender.com/api/recipes")
      .then((response) => response.json())
      .then((data) => {
        setRecipes(data); // ✅ Uložení do kompletního seznamu
        setDisplayRecipes(data); // ✅ Zobrazitelný seznam
      })
      .catch((error) => {
        console.error("Chyba při načítání receptů:", error);
      });
  }, []);

  const shuffleRecipes = () => {
    const shuffled = [...recipes].sort(() => Math.random() - 0.5);
    setDisplayRecipes(shuffled);
  };

  const bestSortRecipes = () => {
    const sorted = [...recipes].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    setDisplayRecipes(sorted);
  };

  const favoriteRecipes = () => {
    const favoriteSetter = [...recipes].sort((a, b) => {
      const ra = a.rating || 0;
      const rb = b.rating || 0;
      return rb - ra;
    });
    setDisplayRecipes(favoriteSetter);
  };

  const difficultyOrder = ["Beginner", "Intermediate", "Hard"];
  const recommendedRecipes = () => {
    const recommendedSetter = [...recipes].sort((a, b) => {
      return (
        difficultyOrder.indexOf(a.difficulty) -
        difficultyOrder.indexOf(b.difficulty)
      );
    });
    setDisplayRecipes(recommendedSetter);
  };

  //Shopping List!!!!!!!!!!!!!!!!!!!!!
  const [text, setText] = useState("");
  const [shop, setShop] = useState([]);
  const [newItem, setNewItem] = useState([]);

  async function fetchShoppingList() {
    const token = localStorage.getItem("token");
    if (!token) {
      // nepřihlášený uživatel → nic nenačítej
      const offline = loadLocalList();
      setNewItem(offline);
      return;
    }

    try {
      const res = await fetch(
        "https://stressfreecheff-backend.onrender.com/api/shopping-list",
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        console.error(
          "Načítání shopping listu FAIL:",
          res.status,
          await res.text()
        );
        return;
      }

      const data = await res.json();
      setNewItem(data);
    } catch (err) {
      console.error("Chyba při fetchi shopping listu:", err);
    }
  }

  useEffect(() => {
    fetchShoppingList();
    fetchItemSuggestions();
  }, []);

  const handleLoginSuccess = async () => {
    await verifyTokenAndSetUserInfo();
    await fetchShoppingList(); // 💥 teď se shopping list načte automaticky
    await fetchShopOptions(); // 🎯 přidáno
    await fetchFavoriteItems(); // ✅ přidáno
    await fetchItemSuggestions();
  };

  const addItem = async (item) => {
    const token = localStorage.getItem("token");
    if (!token) {
      // offline verze
      const current = loadLocalList();
      const newObj = {
        _id: genLocalId(), // aby fungovalo mazání/úpravy v UI
        text: item.text || "",
        shop: [], // offline bez napojení na shop options
        checked: false,
      };
      const updated = [...current, newObj];
      saveLocalList(updated);
      setNewItem(updated);
      return;
    }
    //online
    const res = await fetch(
      "https://stressfreecheff-backend.onrender.com/api/shopping-list",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(item),
      }
    );
    const updatedList = await res.json();
    setNewItem(updatedList);
    await fetchItemSuggestions();
  };

  const updateShoppingItem = async (itemId, updates) => {
    const token = localStorage.getItem("token");
    if (!token) {
      // offline verze – umožníme přepínat checked; shop offline ignorujeme
      const current = loadLocalList();
      const updated = current.map((i) =>
        i._id === itemId
          ? {
              ...i,
              ...("checked" in updates ? { checked: updates.checked } : {}),
              // shop změny necháváme bez efektu v offline módu
            }
          : i
      );
      saveLocalList(updated);
      setNewItem(updated);
      return;
    }

    // online verze (původní)
    const res = await fetch(
      `https://stressfreecheff-backend.onrender.com/api/shopping-list/${itemId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      }
    );
    const updatedList = await res.json();
    setNewItem(updatedList);
    await fetchItemSuggestions();
  };

  const deleteShoppingItem = async (itemId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      // offline verze
      const current = loadLocalList();
      const updated = current.filter((i) => i._id !== itemId);
      saveLocalList(updated);
      setNewItem(updated);
      return;
    }

    // online verze (původní)
    const res = await fetch(
      `https://stressfreecheff-backend.onrender.com/api/shopping-list/${itemId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const updatedList = await res.json();
    setNewItem(updatedList);
    await fetchItemSuggestions();
  };

  //FavoriteItems!!!!!!!!!!!!!!!!!!!!!!!!!!!
  //array vlastnosí itemu
  const [FavoriteNewItem, setFavoriteNewItem] = useState([]);
  //useState+updatovací funkce textu itemu
  const [FavoriteText, setFavoriteText] = useState("");
  const handleFavoriteText = (event) => {
    setFavoriteText(event.target.value);
  };

  //useState+updatovací funkce shopu itemu
  const [FavoriteShop, setFavoriteShop] = useState([]);

  // Načtení favorites
  async function fetchFavoriteItems() {
    const token = localStorage.getItem("token");
    if (!token) {
      setFavoriteNewItem([]);
      return;
    }

    try {
      const res = await fetch(
        "https://stressfreecheff-backend.onrender.com/api/favorites",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(await res.text());
      setFavoriteNewItem(await res.json());
    } catch (e) {
      console.error("Načítání favorites FAIL:", e);
    }
  }

  // Vytvoření favorite položky
  const addFavoriteItem = async (item) => {
    const token = localStorage.getItem("token");
    // item.shop může být: pole objektů { _id, name } nebo pole stringů s _id
    const shopIds = Array.isArray(item.shop)
      ? item.shop
          .map((s) => (typeof s === "string" ? s : s._id))
          .filter(Boolean)
      : [];

    const res = await fetch(
      "https://stressfreecheff-backend.onrender.com/api/favorites",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: item.text, shop: shopIds }),
      }
    );
    const updated = await res.json();
    setFavoriteNewItem(updated);
    await fetchItemSuggestions();
  };

  // Úprava favorite (text / shop)
  const updateFavoriteItem = async (itemId, updates) => {
    const token = localStorage.getItem("token");
    const res = await fetch(
      `https://stressfreecheff-backend.onrender.com/api/favorites/${itemId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        // updates.shop očekává pole _id
        body: JSON.stringify(updates),
      }
    );
    const updated = await res.json();
    setFavoriteNewItem(updated);
    await fetchItemSuggestions();
  };

  // Smazání favorite položky
  const deleteFavoriteItem = async (itemOrId) => {
    const id = typeof itemOrId === "string" ? itemOrId : itemOrId._id;
    const token = localStorage.getItem("token");
    const res = await fetch(
      `https://stressfreecheff-backend.onrender.com/api/favorites/${id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    const updated = await res.json();
    setFavoriteNewItem(updated);
    await fetchItemSuggestions();
  };

  useEffect(() => {
    fetchFavoriteItems();
  }, []);

  //extra !!!!!!!!!!!!!!!!!!!!!!!!!
  const id = Date.now(); // Unikátní ID pro každou položku

  //Item Suggestions
  const [uniqueItemNames, setUniqueItemNames] = useState([]);

  const fetchItemSuggestions = async () => {
    const token = localStorage.getItem("token");
    try {
      if (!token) {
        // offline fallback: aspoň z lokálně zobrazených položek
        const offline = [
          ...new Set(newItem.map((i) => (i.text || "").trim()).filter(Boolean)),
        ];
        setUniqueItemNames(offline);
        return;
      }

      const res = await fetch(
        "https://stressfreecheff-backend.onrender.com/api/item-suggestions",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(await res.text());
      setUniqueItemNames(await res.json());
    } catch (e) {
      console.error("Fetch item suggestions failed:", e);
    }
  };

  return (
    <Router>
      <div>
        <header>
          <nav>
            <ul>
              <li>
                <Link to="/domov" onClick={scrollToTop}>
                  Home
                </Link>
              </li>
              <li>
                <Link to="/ExploreRecipes">Community Recipes</Link>
              </li>
              <li>
                {token ? (
                  <Link to="/NewRecipe">Add Recipe</Link>
                ) : (
                  <Link
                    onClick={() => {
                      alert("Log in to add a new recipe.");
                    }}
                  >
                    Add Recipe
                  </Link>
                )}
              </li>
              <li>
                <Link to="/shopping-list">Shopping List</Link>
              </li>
              <li id="nav">
                <Link to={userInfo ? "/myprofile" : "/authform"}>
                  {userInfo?.username ? userInfo.username : "MyProfile"}
                </Link>
              </li>
            </ul>
          </nav>
        </header>
      </div>
      <Routes>
        <Route
          path="/"
          element={
            <Home
              displayRecipes={displayRecipes}
              recommendedRecipes={recommendedRecipes}
              bestSortRecipes={bestSortRecipes}
              favoriteRecipes={favoriteRecipes}
              shuffleRecipes={shuffleRecipes}
              addItem={addItem}
              setNewItem={setNewItem}
              newItem={newItem}
            />
          }
        />

        <Route
          path="/shopping-list"
          element={
            <ShoppingList
              text={text}
              setText={setText}
              shop={shop}
              setShop={setShop}
              newItem={newItem}
              setNewItem={setNewItem}
              addItem={addItem}
              id={id}
              addFavoriteItem={addFavoriteItem}
              FavoriteNewItem={FavoriteNewItem}
              setFavoriteNewItem={setFavoriteNewItem}
              deleteFavoriteItem={deleteFavoriteItem}
              shopOptions={shopOptions}
              setShopOptions={setShopOptions}
              uniqueItemNames={uniqueItemNames}
              updateShoppingItem={updateShoppingItem} // ✅ přidáno
              deleteShoppingItem={deleteShoppingItem} // ✅ přidáno
            />
          }
        />

        <Route
          path="/domov"
          element={
            <Home
              displayRecipes={displayRecipes}
              recommendedRecipes={recommendedRecipes}
              bestSortRecipes={bestSortRecipes}
              favoriteRecipes={favoriteRecipes}
              shuffleRecipes={shuffleRecipes}
              addItem={addItem}
              setNewItem={setNewItem}
              newItem={newItem}
            />
          }
        />
        <Route
          path="/favoriteItems"
          element={
            <FavoriteItems
              FavoriteNewItem={FavoriteNewItem}
              setFavoriteNewItem={setFavoriteNewItem}
              FavoriteText={FavoriteText}
              setFavoriteText={setFavoriteText}
              handleFavoriteText={handleFavoriteText}
              FavoriteShop={FavoriteShop}
              setFavoriteShop={setFavoriteShop}
              addFavoriteItem={addFavoriteItem}
              addItem={addItem}
              deleteFavoriteItem={deleteFavoriteItem}
              shopOptions={shopOptions}
              setShopOptions={setShopOptions}
              uniqueItemNames={uniqueItemNames}
              updateFavoriteItem={updateFavoriteItem} // ✅ nově
            />
          }
        />
        <Route path="/Recipe" element={<Recipe />} />

        <Route
          path="ExploreRecipes"
          element={<ExploreRecipes addItem={addItem} />}
        />

        <Route path="MyRecipes" element={<MyRecipes />} />

        <Route path="NewRecipe" element={<NewRecipe />} />

        <Route
          path="AuthForm"
          element={<AuthForm onLoginSuccess={handleLoginSuccess} />}
        />

        <Route
          path="/myprofile"
          element={
            userInfo ? (
              <MyProfile userInfo={userInfo} addItem={addItem} />
            ) : (
              <AuthForm onLoginSuccess={handleLoginSuccess} />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
