import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MdAddShoppingCart } from "react-icons/md";
import StarRating from "./StarRating";
import "./Home.css";

/* -----------------------------
   API config
----------------------------- */
const RAW =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "https://stressfreecheff-backend.onrender.com";

const API_BASE = String(RAW || "").replace(/\/+$/, "");

/* -----------------------------
   Helpers
----------------------------- */
function getBaseId(recipe) {
  return String(recipe?._id || recipe?.id || "");
}

function getToken() {
  return localStorage.getItem("token");
}

function pickDisplayedRating(recipe, statsForRecipe) {
  // rating in UI should match sorting when FAVORITE
  if (typeof statsForRecipe?.avg === "number") return statsForRecipe.avg;
  if (typeof recipe?.rating === "number") return recipe.rating;
  return 0;
}

/* -----------------------------
   Component
----------------------------- */
const Home = ({
  displayRecipes,
  recommendedRecipes,
  bestSortRecipes,
  shuffleRecipes,
  addItem,
}) => {
  /* -----------------------------
     States
  ----------------------------- */
  const [sortBy, setSortBy] = useState("newest");
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [savedBaseIds, setSavedBaseIds] = useState([]);
  const [communityStats, setCommunityStats] = useState({});

  /* -----------------------------
     Derived state
  ----------------------------- */
  const selectedBaseId = selectedRecipe ? getBaseId(selectedRecipe) : "";
  const selectedIsSaved = selectedBaseId
    ? savedBaseIds.includes(selectedBaseId)
    : false;

  /* -----------------------------
     Extra
  ----------------------------- */
  function openModal(recipe) {
    setSelectedRecipe(recipe);
  }

  async function toggleSaveOfficial(recipe) {
    const baseId = getBaseId(recipe);
    if (!baseId) return;

    const token = getToken();
    if (!token) {
      alert("Please login to save recipes.");
      return;
    }

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

    if (savedBaseIds.includes(baseId)) {
      await fetch(`${API_BASE}/api/saved-community-recipes/${communityId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      setSavedBaseIds((prev) => prev.filter((id) => id !== baseId));
      return;
    }

    await fetch(`${API_BASE}/api/saved-community-recipes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipeId: communityId }),
    });

    setSavedBaseIds((prev) =>
      prev.includes(baseId) ? prev : [...prev, baseId]
    );
  }

  function onPickSort(nextSort) {
    setSortBy(nextSort);

    if (nextSort === "newest") bestSortRecipes();
    if (nextSort === "easiest") recommendedRecipes();
    if (nextSort === "random") shuffleRecipes();
  }

  /* -----------------------------
     Effects
  ----------------------------- */

  useEffect(() => {
    document.body.style.overflow = selectedRecipe ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [selectedRecipe]);

  useEffect(() => {
    (async () => {
      try {
        const token = getToken();
        if (!token) {
          setSavedBaseIds([]);
          return;
        }

        const res = await fetch(`${API_BASE}/api/saved-community-recipes`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();

        const arr = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
          ? data.items
          : [];

        const baseIds = [];

        for (const r of arr) {
          const src = r?.sourceRecipeId;
          if (!src) continue;
          baseIds.push(typeof src === "object" ? src._id : src);
        }

        setSavedBaseIds(baseIds);

        setSavedBaseIds(baseIds);
      } catch {
        setSavedBaseIds([]);
      }
    })();
  }, []);

  useEffect(() => {
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

        if (!aborted) {
          setCommunityStats(Object.fromEntries(pairs.filter(Boolean)));
        }
      } catch {
        if (!aborted) setCommunityStats({});
      }
    })();

    return () => {
      aborted = true;
    };
  }, [displayRecipes]);

  /* -----------------------------
     Memo
  ----------------------------- */
  const recipesToRender = useMemo(() => {
    const base = [...(displayRecipes || [])];

    if (sortBy === "newest") {
      base.sort((a, b) => {
        const da = new Date(a?.createdAt || 0).getTime();
        const db = new Date(b?.createdAt || 0).getTime();
        return db - da;
      });
    }

    if (sortBy === "favorite") {
      base.sort((a, b) => {
        const idA = a?._id || a?.id;
        const idB = b?._id || b?.id;

        const ratingA = pickDisplayedRating(a, communityStats[idA]);
        const ratingB = pickDisplayedRating(b, communityStats[idB]);

        return ratingB - ratingA;
      });
    }

    return base;
  }, [displayRecipes, communityStats, sortBy]);

  /* -----------------------------
     Render
  ----------------------------- */
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
                href="#newest"
                onClick={(e) => {
                  e.preventDefault();
                  onPickSort("newest");
                }}
                className={sortBy === "newest" ? "activeSection" : ""}
              >
                NEWEST
              </a>
            </li>

            <li>
              <a
                href="#recommended"
                onClick={(e) => {
                  e.preventDefault();
                  onPickSort("easiest");
                }}
                className={sortBy === "easiest" ? "activeSection" : ""}
              >
                EASIEST
              </a>
            </li>

            <li>
              <a
                href="#favorite"
                onClick={(e) => {
                  e.preventDefault();
                  onPickSort("favorite");
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
                  onPickSort("random");
                }}
                className={sortBy === "random" ? "activeSection" : ""}
              >
                RANDOM
              </a>
            </li>
          </ul>
        </section>

        <div className="recipeContainer">
          {recipesToRender.map((recipe) => {
            const rid = recipe?._id || recipe?.id;
            const stats = communityStats[rid];

            return (
              <div className="recipeCard" key={rid}>
                <a href="#modal">
                  <img onClick={() => openModal(recipe)} src={recipe.imgSrc} />
                </a>

                <h3>{recipe.title}</h3>

                <StarRating
                  value={pickDisplayedRating(recipe, stats)}
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

              <div id="modal">
                <div className="nameAndPicture">
                  <h2>{selectedRecipe.title}</h2>
                  <img src={selectedRecipe.imgSrc} />
                </div>

                <div className="displayIngredience">
                  <ol>
                    {selectedRecipe.ingredients.map((ingredient, index) => (
                      <li key={index} className="ingredient">
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
                    ))}
                  </ol>
                </div>
              </div>

              <div id="startparent">
                <Link
                  to="/Recipe"
                  state={{
                    recipe: selectedRecipe,
                    communityRecipeId:
                      communityStats[getBaseId(selectedRecipe)]?.id ||
                      undefined,
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
