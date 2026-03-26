import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StarRating from "../../components/ui/StarRating";
import RecipeModal from "../../components/RecipeModal";
import "./Home.css";
import { API_BASE } from "../../api/client";
import { useShopping } from "../../context/ShoppingContext";

function getBaseId(recipe) {
  return String(recipe?._id || recipe?.id || "");
}

function getToken() {
  return localStorage.getItem("token");
}

function pickDisplayedRating(recipe, statsForRecipe) {
  if (typeof statsForRecipe?.avg === "number") return statsForRecipe.avg;
  if (typeof recipe?.rating === "number") return recipe.rating;
  return 0;
}

const SORT_OPTIONS = [
  { key: "newest", label: "NEWEST" },
  { key: "easiest", label: "EASIEST" },
  { key: "favorite", label: "FAVORITE" },
  { key: "random", label: "RANDOM" },
];

const Home = () => {
  const { addItem } = useShopping();

  /* -- Recipes state (local – only used here) -- */
  const [recipes, setRecipes] = useState([]);
  const [displayRecipes, setDisplayRecipes] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/recipes`)
      .then((res) => res.json())
      .then((data) => {
        setRecipes(data);
        setDisplayRecipes(data);
      })
      .catch((err) => console.error("Chyba při načítání receptů:", err));
  }, []);

  const difficultyOrder = ["Beginner", "Intermediate", "Hard"];

  function shuffleRecipes() {
    setDisplayRecipes([...recipes].sort(() => Math.random() - 0.5));
  }

  function bestSortRecipes() {
    setDisplayRecipes(
      [...recipes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    );
  }

  function recommendedRecipes() {
    setDisplayRecipes(
      [...recipes].sort(
        (a, b) =>
          difficultyOrder.indexOf(a.difficulty) -
          difficultyOrder.indexOf(b.difficulty),
      ),
    );
  }

  /* -- UI state -- */
  const [sortBy, setSortBy] = useState("newest");
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [savedBaseIds, setSavedBaseIds] = useState([]);
  const [communityStats, setCommunityStats] = useState({});

  const selectedBaseId = selectedRecipe ? getBaseId(selectedRecipe) : "";
  const selectedIsSaved = selectedBaseId
    ? savedBaseIds.includes(selectedBaseId)
    : false;

  /* -- Handlers -- */
  function onPickSort(nextSort) {
    setSortBy(nextSort);
    if (nextSort === "newest") bestSortRecipes();
    if (nextSort === "easiest") recommendedRecipes();
    if (nextSort === "random") shuffleRecipes();
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
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
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
      prev.includes(baseId) ? prev : [...prev, baseId],
    );
  }

  /* -- Effects -- */
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
        if (!token) { setSavedBaseIds([]); return; }
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
      } catch {
        setSavedBaseIds([]);
      }
    })();
  }, []);

  useEffect(() => {
    const ids = Array.from(
      new Set(
        (displayRecipes || []).map((r) => r?._id || r?.id).filter(Boolean),
      ),
    );
    if (ids.length === 0) { setCommunityStats({}); return; }

    let aborted = false;
    (async () => {
      try {
        const pairs = await Promise.all(
          ids.map(async (rid) => {
            const res = await fetch(
              `${API_BASE}/api/community-recipes/ensure-from-recipe/${rid}`,
              { method: "POST" },
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
          }),
        );
        if (!aborted) {
          setCommunityStats(Object.fromEntries(pairs.filter(Boolean)));
        }
      } catch {
        if (!aborted) setCommunityStats({});
      }
    })();
    return () => { aborted = true; };
  }, [displayRecipes]);

  /* -- Sorted list -- */
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
        return (
          pickDisplayedRating(b, communityStats[idB]) -
          pickDisplayedRating(a, communityStats[idA])
        );
      });
    }
    return base;
  }, [displayRecipes, communityStats, sortBy]);

  /* -- Render -- */
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
            {SORT_OPTIONS.map(({ key, label }) => (
              <li key={key}>
                <a
                  href={`#${key}`}
                  onClick={(e) => { e.preventDefault(); onPickSort(key); }}
                  className={sortBy === key ? "activeSection" : ""}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <div className="recipeContainer">
          {recipesToRender.map((recipe) => {
            const rid = recipe?._id || recipe?.id;
            const stats = communityStats[rid];
            return (
              <div className="recipeCard" key={rid}>
                <a href="#modal">
                  <img
                    onClick={() => setSelectedRecipe(recipe)}
                    src={recipe.imgSrc}
                  />
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
          <RecipeModal
            recipe={selectedRecipe}
            onClose={() => setSelectedRecipe(null)}
            communityRecipeId={
              communityStats[getBaseId(selectedRecipe)]?.id || undefined
            }
            isSaved={selectedIsSaved}
            onToggleSave={toggleSaveOfficial}
          />
        )}
      </div>
    </main>
  );
};

export default Home;
