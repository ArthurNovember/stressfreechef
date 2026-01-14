import { useEffect, useMemo, useState } from "react";
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

/* -----------------------------
   API config + helpers
----------------------------- */
const RAW =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "https://stressfreecheff-backend.onrender.com";
const API_BASE = String(RAW || "").replace(/\/+$/, "");

function getToken() {
  return localStorage.getItem("token");
}

async function readJson(res) {
  const data = await res.json().catch(() => null);
  return data;
}

/* -----------------------------
   Offline ShoppingList fallback
----------------------------- */
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

/* -----------------------------
   Component
----------------------------- */
function App() {
  const [userInfo, setUserInfo] = useState(null);

  const token = useMemo(() => getToken(), [userInfo]);

  async function verifyTokenAndSetUserInfo() {
    const token = getToken();
    if (!token) {
      setUserInfo(null);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/profile`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await readJson(res);

      if (res.ok) {
        setUserInfo(data?.user ?? null);
      } else {
        localStorage.removeItem("token");
        setUserInfo(null);
      }
    } catch (err) {
      console.error("Chyba při ověřování tokenu:", err);
      setUserInfo(null);
    }
  }

  /* -----------------------------
     Shop options
  ----------------------------- */
  const [shopOptions, setShopOptions] = useState([]);

  async function fetchShopOptions() {
    const token = getToken();
    if (!token) {
      setShopOptions([]);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/shopping-list/shop-options`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(await res.text());
      setShopOptions(await res.json());
    } catch (e) {
      console.error("Shop options FAIL:", e);
    }
  }

  /* -----------------------------
     Recipes (official)
  ----------------------------- */
  const [recipes, setRecipes] = useState([]);
  const [displayRecipes, setDisplayRecipes] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/recipes`)
      .then((res) => res.json())
      .then((data) => {
        setRecipes(data);
        setDisplayRecipes(data);
      })
      .catch((error) => {
        console.error("Chyba při načítání receptů:", error);
      });
  }, []);

  function shuffleRecipes() {
    const shuffled = [...recipes].sort(() => Math.random() - 0.5);
    setDisplayRecipes(shuffled);
  }

  function bestSortRecipes() {
    const sorted = [...recipes].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    setDisplayRecipes(sorted);
  }

  const difficultyOrder = ["Beginner", "Intermediate", "Hard"];
  function recommendedRecipes() {
    const sorted = [...recipes].sort((a, b) => {
      return (
        difficultyOrder.indexOf(a.difficulty) -
        difficultyOrder.indexOf(b.difficulty)
      );
    });
    setDisplayRecipes(sorted);
  }

  /* -----------------------------
     Shopping List (online + offline)
  ----------------------------- */
  const [text, setText] = useState("");
  const [shop, setShop] = useState([]);
  const [newItem, setNewItem] = useState([]);

  async function fetchShoppingList() {
    const token = getToken();

    if (!token) {
      setNewItem(loadLocalList());
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/shopping-list`, {
        headers: { Authorization: `Bearer ${token}` },
      });

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

  async function addItem(item) {
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
      setNewItem(updated);
      return;
    }

    const res = await fetch(`${API_BASE}/api/shopping-list`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(item),
    });

    const updatedList = await res.json();
    setNewItem(updatedList);
    await fetchItemSuggestions();
  }

  async function updateShoppingItem(itemId, updates) {
    const token = getToken();

    if (!token) {
      const current = loadLocalList();
      const updated = current.map((i) =>
        i._id === itemId
          ? {
              ...i,
              ...("checked" in updates ? { checked: updates.checked } : {}),
            }
          : i
      );

      saveLocalList(updated);
      setNewItem(updated);
      return;
    }

    const res = await fetch(`${API_BASE}/api/shopping-list/${itemId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    const updatedList = await res.json();
    setNewItem(updatedList);
    await fetchItemSuggestions();
  }

  async function deleteShoppingItem(itemId) {
    const token = getToken();

    if (!token) {
      const current = loadLocalList();
      const updated = current.filter((i) => i._id !== itemId);

      saveLocalList(updated);
      setNewItem(updated);
      return;
    }

    const res = await fetch(`${API_BASE}/api/shopping-list/${itemId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const updatedList = await res.json();
    setNewItem(updatedList);
    await fetchItemSuggestions();
  }

  /* -----------------------------
     Favorite Items
  ----------------------------- */
  const [FavoriteNewItem, setFavoriteNewItem] = useState([]);
  const [FavoriteText, setFavoriteText] = useState("");
  const [FavoriteShop, setFavoriteShop] = useState([]);

  function handleFavoriteText(event) {
    setFavoriteText(event.target.value);
  }

  async function fetchFavoriteItems() {
    const token = getToken();
    if (!token) {
      setFavoriteNewItem([]);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/favorites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setFavoriteNewItem(await res.json());
    } catch (e) {
      console.error("Načítání favorites FAIL:", e);
    }
  }

  async function addFavoriteItem(item) {
    const token = getToken();

    const shopIds = Array.isArray(item?.shop)
      ? item.shop
          .map((s) => (typeof s === "string" ? s : s?._id))
          .filter(Boolean)
      : [];

    const res = await fetch(`${API_BASE}/api/favorites`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: item?.text, shop: shopIds }),
    });

    const updated = await res.json();
    setFavoriteNewItem(updated);
    await fetchItemSuggestions();
  }

  async function updateFavoriteItem(itemId, updates) {
    const token = getToken();

    const res = await fetch(`${API_BASE}/api/favorites/${itemId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    const updated = await res.json();
    setFavoriteNewItem(updated);
    await fetchItemSuggestions();
  }

  async function deleteFavoriteItem(itemOrId) {
    const id = typeof itemOrId === "string" ? itemOrId : itemOrId?._id;
    if (!id) return;

    const token = getToken();
    const res = await fetch(`${API_BASE}/api/favorites/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const updated = await res.json();
    setFavoriteNewItem(updated);
    await fetchItemSuggestions();
  }

  /* -----------------------------
     Item Suggestions
  ----------------------------- */
  const [uniqueItemNames, setUniqueItemNames] = useState([]);

  async function fetchItemSuggestions() {
    const token = getToken();

    try {
      if (!token) {
        const offline = [
          ...new Set(newItem.map((i) => (i.text || "").trim()).filter(Boolean)),
        ];
        setUniqueItemNames(offline);
        return;
      }

      const res = await fetch(`${API_BASE}/api/item-suggestions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(await res.text());
      setUniqueItemNames(await res.json());
    } catch (e) {
      console.error("Fetch item suggestions failed:", e);
    }
  }

  /* -----------------------------
     Effects 
  ----------------------------- */
  useEffect(() => {
    verifyTokenAndSetUserInfo();
  }, []);

  useEffect(() => {
    fetchShopOptions();
  }, []);

  useEffect(() => {
    fetchShoppingList();
    fetchItemSuggestions();
    fetchFavoriteItems();
  }, []);

  /* -----------------------------
     UI helpers
  ----------------------------- */
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleLoginSuccess() {
    await verifyTokenAndSetUserInfo();
    await fetchShoppingList();
    await fetchShopOptions();
    await fetchFavoriteItems();
    await fetchItemSuggestions();
  }

  /* -----------------------------
     Render
  ----------------------------- */
  return (
    <Router>
      <div>
        <header>
          <nav>
            <ul>
              <li>
                <Link to="/home" onClick={scrollToTop}>
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
                  {userInfo?.username ? userInfo.username : "My Profile"}
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
              shuffleRecipes={shuffleRecipes}
              addItem={addItem}
            />
          }
        />

        <Route
          path="/home"
          element={
            <Home
              displayRecipes={displayRecipes}
              recommendedRecipes={recommendedRecipes}
              bestSortRecipes={bestSortRecipes}
              shuffleRecipes={shuffleRecipes}
              addItem={addItem}
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
              addFavoriteItem={addFavoriteItem}
              FavoriteNewItem={FavoriteNewItem}
              setFavoriteNewItem={setFavoriteNewItem}
              deleteFavoriteItem={deleteFavoriteItem}
              shopOptions={shopOptions}
              setShopOptions={setShopOptions}
              uniqueItemNames={uniqueItemNames}
              updateShoppingItem={updateShoppingItem}
              deleteShoppingItem={deleteShoppingItem}
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
              updateFavoriteItem={updateFavoriteItem}
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
