import { useState } from "react";
import "./App.css";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import ShoppingList from "./pages/ShoppingList/ShoppingList";
import Home from "./pages/Home/Home";
import FavoriteItems from "./pages/FavoriteItems/FavoriteItems";
import Recipe from "./pages/Recipe/Recipe";
import ExploreRecipes from "./pages/ExploreRecipes/ExploreRecipes";
import MyRecipes from "./pages/MyRecipes/MyRecipes";
import NewRecipe from "./pages/NewRecipe/NewRecipe";
import AuthForm from "./pages/AuthForm/AuthForm";
import MyProfile from "./pages/MyProfile/MyProfile";

function App() {
  const { userInfo } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <Router>
      <div>
        <header className="header">
          <div className="navRow">
            <button
              className="burgerBtn"
              onClick={() => setIsMenuOpen((v) => !v)}
              aria-label="Open menu"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-nav"
              type="button"
            >
              <div>
                <span className="burgerLine" />
                <span className="burgerLine" />
                <span className="burgerLine" />
              </div>
            </button>

            <nav className="nav">
              <ul
                id="mobile-nav"
                className={`navList ${isMenuOpen ? "open" : ""}`}
              >
                <li>
                  <Link
                    to="/home"
                    onClick={() => {
                      setIsMenuOpen(false);
                      scrollToTop();
                    }}
                  >
                    Home
                  </Link>
                </li>

                <li>
                  <Link
                    to="/ExploreRecipes"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Community Recipes
                  </Link>
                </li>

                <li>
                  {userInfo ? (
                    <Link to="/NewRecipe" onClick={() => setIsMenuOpen(false)}>
                      Add Recipe
                    </Link>
                  ) : (
                    <Link
                      onClick={() => {
                        setIsMenuOpen(false);
                        alert("Log in to add a new recipe.");
                      }}
                    >
                      Add Recipe
                    </Link>
                  )}
                </li>

                <li>
                  <Link
                    to="/shopping-list"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Shopping List
                  </Link>
                </li>

                <li id="nav">
                  <Link
                    to={userInfo ? "/myprofile" : "/authform"}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {userInfo?.username ?? "My Profile"}
                  </Link>
                </li>
              </ul>
            </nav>

            {isMenuOpen && (
              <button
                className="navOverlay"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Close menu overlay"
                type="button"
              />
            )}
          </div>
        </header>
      </div>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/shopping-list" element={<ShoppingList />} />
        <Route path="/favoriteItems" element={<FavoriteItems />} />
        <Route path="/Recipe" element={<Recipe />} />
        <Route path="/ExploreRecipes" element={<ExploreRecipes />} />
        <Route path="/MyRecipes" element={<MyRecipes />} />
        <Route path="/NewRecipe" element={<NewRecipe />} />
        <Route path="/AuthForm" element={<AuthForm />} />
        <Route path="/authform" element={<AuthForm />} />
        <Route
          path="/myprofile"
          element={userInfo ? <MyProfile /> : <AuthForm />}
        />
      </Routes>
    </Router>
  );
}

export default App;
