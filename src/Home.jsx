import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import StarRating from "./StarRating";
import { MdAddShoppingCart } from "react-icons/md";

const RAW =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "https://stressfreecheff-backend.onrender.com";
const API_BASE = String(RAW || "").replace(/\/+$/, "");

const Home = ({
  displayRecipes,
  recommendedRecipes,
  bestSortRecipes,
  favoriteRecipes,
  shuffleRecipes,
  addItem,
  setNewItem,
  NewItem,
}) => {
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [savedBaseIds, setSavedBaseIds] = useState([]);
  const selectedBaseId = selectedRecipe
    ? String(selectedRecipe._id || selectedRecipe.id || "")
    : "";

  const selectedIsSaved = selectedBaseId
    ? savedBaseIds.includes(selectedBaseId)
    : false;

  const [sortBy, setSortBy] = useState("newest");

  async function toggleSaveOfficial(recipe) {
    if (!recipe) return;

    const baseId = String(recipe._id || recipe.id || "");
    if (!baseId) return;

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please login to save recipes.");
      return;
    }

    // 1) ensure community copy
    const ensureRes = await fetch(
      `${API_BASE}/api/community-recipes/ensure-from-recipe/${baseId}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const ensure = await ensureRes.json();
    const communityId = ensure?._id;
    if (!communityId) return;

    // 2) pokud už uložené → UNSAVE
    if (savedBaseIds.includes(baseId)) {
      await fetch(`${API_BASE}/api/saved-community-recipes/${communityId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      setSavedBaseIds((p) => p.filter((id) => id !== baseId));
      return;
    }

    // 3) jinak uložit
    await fetch(`${API_BASE}/api/saved-community-recipes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipeId: communityId }),
    });

    setSavedBaseIds((p) => (p.includes(baseId) ? p : [...p, baseId]));
  }

  const openModal = (recipe) => {
    setSelectedRecipe(recipe);
  };
  const closeModal = () => {
    setSelectedRecipe(null);
  };

  useEffect(() => {
    if (selectedRecipe) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [selectedRecipe]);

  const [communityStats, setCommunityStats] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setSavedBaseIds([]);
          return;
        }

        const res = await fetch(`${API_BASE}/api/saved-community-recipes`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        const baseIds = [];

        if (Array.isArray(data)) {
          for (const r of data) {
            const src = r.sourceRecipeId;
            if (src) {
              baseIds.push(typeof src === "object" ? src._id : src);
            }
          }
        }

        setSavedBaseIds(baseIds);
      } catch {
        setSavedBaseIds([]);
      }
    })();
  }, []);

  useEffect(() => {
    // seber unikátní ofiko ID (id nebo _id)
    const ids = Array.from(
      new Set(
        (displayRecipes || []).map((r) => r?._id || r?.id).filter(Boolean)
      )
    );

    if (ids.length === 0) {
      setCommunityStats({});
      return;
    }

    let aborted = false;
    (async () => {
      try {
        const pairs = await Promise.all(
          ids.map(async (rid) => {
            // zajistí/vrátí community dvojče pro ofiko recipe
            const res = await fetch(
              `${API_BASE}/api/community-recipes/ensure-from-recipe/${rid}`,
              { method: "POST" }
            );
            const data = await res.json();
            if (!res.ok || !data?._id) return [rid, null];
            return [
              rid,
              {
                id: data._id,
                avg: Number(data.ratingAvg || 0),
                count: Number(data.ratingCount || 0),
              },
            ];
          })
        );
        if (!aborted)
          setCommunityStats(Object.fromEntries(pairs.filter(Boolean)));
      } catch {
        if (!aborted) setCommunityStats({});
      }
    })();

    return () => {
      aborted = true;
    };
  }, [displayRecipes]);

  return (
    <main>
      <div className="main">
        <div className="logoText">
          <p className="StressFree">
            Stress Free <span className="chef">Chef</span>
          </p>
        </div>
        <section className="variants">
          <ul className="HomeUl">
            <li>
              <a
                href="#recommended"
                onClick={(e) => {
                  e.preventDefault(); // ať to neskáče na #
                  setSortBy("easiest"); // nastavíme aktivní sort
                  recommendedRecipes(); // zavoláme tvoji funkci
                }}
                className={sortBy === "easiest" ? "activeSection" : ""}
              >
                EASIEST
              </a>
            </li>

            <li>
              <a
                href="#newest"
                onClick={(e) => {
                  e.preventDefault();
                  setSortBy("newest");
                  bestSortRecipes();
                }}
                className={sortBy === "newest" ? "activeSection" : ""}
              >
                NEWEST
              </a>
            </li>

            <li>
              <a
                href="#favorite"
                onClick={(e) => {
                  e.preventDefault();
                  setSortBy("favorite");
                  favoriteRecipes();
                }}
                className={sortBy === "favorite" ? "activeSection" : ""}
              >
                FAVORITE
              </a>
            </li>

            <li>
              <a
                href="#random"
                onClick={(e) => {
                  e.preventDefault();
                  setSortBy("random");
                  shuffleRecipes();
                }}
                className={sortBy === "random" ? "activeSection" : ""}
              >
                RANDOM
              </a>
            </li>
          </ul>
        </section>

        <div className="recipeContainer">
          {displayRecipes.map((recipe) => {
            const rid = recipe?._id || recipe?.id; // ← TADY vzniká rid
            const stats = communityStats[rid]; // ← a TADY stats (avg,count)

            return (
              <div className="recipeCard" key={rid}>
                <a href="#forNow">
                  <img onClick={() => openModal(recipe)} src={recipe.imgSrc} />
                </a>
                <h3>{recipe.title}</h3>

                <StarRating
                  value={
                    typeof stats?.avg === "number"
                      ? stats.avg
                      : recipe?.rating || 0
                  }
                  readOnly
                  showValue
                  count={stats?.count}
                />

                <p className={recipe.difficulty}>
                  Difficulty: {recipe.difficulty}
                </p>
                <p>Time: {recipe.time}⏱️</p>
              </div>
            );
          })}
        </div>

        {selectedRecipe && (
          <div className="modalOverlay" onClick={() => setSelectedRecipe(null)}>
            <div
              className="selectedRecipeContainer"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className={`saveFloatingBtn ${selectedIsSaved ? "active" : ""}`}
                onClick={() => toggleSaveOfficial(selectedRecipe)}
              >
                {selectedIsSaved ? "SAVED" : "SAVE"}
              </button>

              <div id="forNow">
                <div className="nameAndPicture">
                  <h2>{selectedRecipe.title}</h2>
                  <img src={selectedRecipe.imgSrc} />
                </div>

                <div className="displayIngredience">
                  <ol>
                    {selectedRecipe.ingredients.map((ingredient, index) => {
                      return (
                        <li key={index} className="ingredient">
                          {" "}
                          {ingredient}
                          <button
                            className="sendToList"
                            onClick={() =>
                              addItem({
                                text: ingredient,
                                shop: [],
                              })
                            }
                          >
                            <MdAddShoppingCart size={18} color="#ffffff" />
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
              <div id="startparent">
                <Link
                  to="/Recipe"
                  state={{
                    recipe: selectedRecipe,
                    communityRecipeId:
                      communityStats[selectedRecipe?._id || selectedRecipe?.id]
                        ?.id || undefined,
                  }}
                >
                  <button className="getStarted">GET STARTED</button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default Home;
