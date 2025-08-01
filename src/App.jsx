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

  // 🧠 přidej v App.jsx
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
    const favoriteSetter = [...recipes].sort((a, b) => b.rating - a.rating);
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
  const addItem = (item) => {
    setNewItem((prevItem) => {
      return [...prevItem, item];
    });
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
  const handleFavoriteShop = (event) => {
    setFavoriteShop(event.target.value);
  };

  //funkce na přidání itemu
  const addFavoriteItem = (item) => {
    {
      if (!FavoriteNewItem.find((fav) => fav.text === item.text))
        setFavoriteNewItem((prevFavoriteItems) => {
          return [...prevFavoriteItems, item];
        });
    }
  };
  //Funkce mazání itemu
  const deleteFavoriteItem = (itemToDelete) => {
    setFavoriteNewItem((prev) =>
      prev.filter(
        (fav) =>
          fav.text.toLowerCase().trim() !==
          itemToDelete.text.toLowerCase().trim()
      )
    );
  };

  //extra !!!!!!!!!!!!!!!!!!!!!!!!!
  const id = Date.now(); // Unikátní ID pro každou položku
  const uniqueItemNames = [...new Set(newItem.map((item) => item.text))];

  //Shoppy
  const [shopOptions, setShopOptions] = useState(["Albert", "Lidl"]);
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
                <Link to="/ExploreRecipes">Explore Recipes</Link>
              </li>
              <li>
                <Link to="/MyRecipes">My Recipes</Link>
              </li>
              <li>
                <Link to="/shopping-list">Shopping List</Link>
              </li>
              <li id="nav">
                <Link to={token ? "/myprofile" : "/authform"}>MyProfile</Link>
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
              handleFavoriteShop={handleFavoriteShop}
              addFavoriteItem={addFavoriteItem}
              addItem={addItem}
              deleteFavoriteItem={deleteFavoriteItem}
              shopOptions={shopOptions}
              setShopOptions={setShopOptions}
              uniqueItemNames={uniqueItemNames}
            />
          }
        />
        <Route path="/Recipe" element={<Recipe />} />

        <Route path="ExploreRecipes" element={<ExploreRecipes />} />

        <Route path="MyRecipes" element={<MyRecipes />} />

        <Route path="NewRecipe" element={<NewRecipe />} />

        <Route
          path="AuthForm"
          element={<AuthForm onLoginSuccess={verifyTokenAndSetUserInfo} />}
        />
        <Route
          path="/myprofile"
          element={
            userInfo ? (
              <MyProfile userInfo={userInfo} />
            ) : (
              <AuthForm onLoginSuccess={verifyTokenAndSetUserInfo} />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
