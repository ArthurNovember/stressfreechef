import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import StarRating from "./StarRating";

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

  const [animateLogo, setAnimateLogo] = useState(false);
  const handleHover = () => {
    setAnimateLogo(true);
  };
  const handleAnimationEnd = () => {
    setAnimateLogo(false);
  };

  return (
    <main>
      <div className="main">
        <div className="logoText">
          <img
            src="https://i.imgur.com/EdgU8NN.png"
            className={`logo ${animateLogo ? "animate" : ""}`}
            onMouseEnter={handleHover}
            onAnimationEnd={handleAnimationEnd}
          />
          <p>Stress Free Chef</p>
        </div>
        <section className="variants">
          <ul className="HomeUl">
            <li>
              <a href="#recommended" onClick={recommendedRecipes}>
                RECOMMENDED
              </a>
            </li>
            <li>
              <a href="#newest" onClick={bestSortRecipes}>
                NEWEST
              </a>
            </li>
            <li>
              <a href="#favorite" onClick={favoriteRecipes}>
                FAVORITE
              </a>
            </li>
            <li>
              <a href="#random" onClick={shuffleRecipes}>
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
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <div id="forNow">
                <div className="nameAndPicture">
                  <h2>{selectedRecipe.title}</h2>
                  <img src={selectedRecipe.imgSrc} />
                </div>

                <div className="displayIngredience">
                  <ol>
                    {selectedRecipe.ingredients.map((ingredient, index) => {
                      return (
                        <li key={index}>
                          {" "}
                          <input type="checkbox" /> {ingredient}{" "}
                          <button
                            className="sendToList"
                            onClick={() =>
                              addItem({
                                text: ingredient,
                                shop: [],
                              })
                            }
                          >
                            Send to shopping list
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
