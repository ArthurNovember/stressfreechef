import React, { useEffect, useState } from "react";
import "./exploreRecipes.css";
import { Link } from "react-router-dom";
import StarRating from "./StarRating";
import { MdAddShoppingCart } from "react-icons/md";

// 🌍 nastav si svou produkční backend URL jako fallback
const DEPLOYED_BACKEND_URL = "https://stressfreecheff-backend.onrender.com";

const RAW_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  DEPLOYED_BACKEND_URL;

const API_BASE = String(RAW_BASE || "").replace(/\/+$/, "");
const API_URL = `${API_BASE}/api/community-recipes`;

const PLACEHOLDER_IMG = "https://i.imgur.com/CZaFjz2.png";

/** Rozhodni, zda je URL/format video */
const isVideoFormat = (fmt = "", url = "") => {
  const f = String(fmt || "")
    .toLowerCase()
    .trim();
  return (
    ["mp4", "webm", "mov", "m4v"].includes(f) ||
    /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(String(url || ""))
  );
};

const findFirstImageStepSrc = (steps = []) => {
  if (!Array.isArray(steps)) return "";
  const s = steps.find((x) => x?.type === "image" && x?.src);
  return s?.src || "";
};

const findAnyStepSrc = (steps = []) => {
  if (!Array.isArray(steps)) return "";
  const s = steps.find((x) => x?.src);
  return s?.src || "";
};

/** Cover pořadí: image.url -> imgSrc -> první image step -> jakýkoli step -> placeholder */
const getCover = (r) => {
  const url =
    r?.image?.url ||
    r?.imgSrc ||
    findFirstImageStepSrc(r?.steps) ||
    findAnyStepSrc(r?.steps) ||
    "";

  const fmt = r?.image?.format || "";
  const isVideo = isVideoFormat(fmt, url);
  return { url: url || PLACEHOLDER_IMG, isVideo };
};

const getEffectiveRating = (r) =>
  typeof r?.ratingAvg === "number" ? r.ratingAvg : r?.rating || 0;

const ExploreRecipes = ({ addItem }) => {
  const [items, setItems] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(14);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [savedCommunityIds, setSavedCommunityIds] = useState([]);

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

  const ThumbnailUrl = getCover(selectedRecipe).url;
  const isVideoSelected = getCover(selectedRecipe).isVideo;

  const [displayRecipes, setDisplayRecipes] = useState([]);
  const [sortBy, setSortBy] = useState("newest");

  // Debounce vyhledávání (300 ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setSavedCommunityIds([]);
          return;
        }

        const res = await fetch(`${API_BASE}/api/saved-community-recipes`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        const ids = Array.isArray(data)
          ? data.map((r) => r?.recipeId || r?._id).filter(Boolean)
          : [];

        setSavedCommunityIds(ids);
      } catch {
        setSavedCommunityIds([]);
      }
    })();
  }, []);

  // Fetch dat
  useEffect(() => {
    let aborted = false;

    const fetchData = async () => {
      setLoading(true);
      setErr("");

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (debouncedQ) params.set("q", debouncedQ);

      try {
        const url = `${API_URL}?${params.toString()}`;
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
        });
        const contentType = (
          res.headers.get("content-type") || ""
        ).toLowerCase();
        const raw = await res.text();

        if (!res.ok)
          throw new Error(`HTTP ${res.status}: ${raw.slice(0, 200)}`);
        if (!contentType.includes("application/json")) {
          throw new Error(
            `Non-JSON response (HTTP ${
              res.status
            }). Check URL/CORS.\n${raw.slice(0, 200)}`
          );
        }

        const data = JSON.parse(raw);
        if (aborted) return;

        const newItems = Array.isArray(data.items) ? data.items : [];
        const totalFromApi = Number(data.total) || 0;
        const pagesFromApi = Number(data.pages) || 1;

        setTotal(totalFromApi);
        setPages(pagesFromApi);

        // když page === 1, je to nový search → přepiš
        // jinak přidej na konec
        setItems((prev) => (page === 1 ? newItems : [...prev, ...newItems]));
      } catch (e) {
        if (!aborted) setErr(e?.message || "Failed to load recipes.");
      } finally {
        if (!aborted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      aborted = true;
    };
  }, [page, limit, debouncedQ]);

  // reset page na 1 při změně hledání
  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const canPrev = page > 1;
  const canNext = page < pages;

  const shuffleRecipes = () => {
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    setDisplayRecipes(shuffled);
  };

  const bestSortRecipes = () => {
    const sorted = [...items].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    setDisplayRecipes(sorted);
  };

  const favoriteRecipes = () => {
    const sorted = [...items].sort(
      (a, b) => (b.ratingAvg ?? b.rating ?? 0) - (a.ratingAvg ?? a.rating ?? 0)
    );
    setDisplayRecipes(sorted);
  };

  const difficultyOrder = ["Beginner", "Intermediate", "Hard"];
  const recommendedRecipes = () => {
    const sorted = [...items].sort(
      (a, b) =>
        difficultyOrder.indexOf(a.difficulty) -
        difficultyOrder.indexOf(b.difficulty)
    );
    setDisplayRecipes(sorted);
  };

  useEffect(() => {
    if (sortBy === "easiest") recommendedRecipes();
    else if (sortBy === "favorite") favoriteRecipes();
    else if (sortBy === "random") shuffleRecipes();
    else bestSortRecipes(); // newest
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sortBy]);

  async function toggleSaveExplore(recipe) {
    if (!recipe?._id) return;

    const rid = recipe._id;
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please login to save recipes.");
      return;
    }

    // pokud už uložený → UNSAVE
    if (savedCommunityIds.includes(rid)) {
      await fetch(`${API_BASE}/api/saved-community-recipes/${rid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      setSavedCommunityIds((p) => p.filter((id) => id !== rid));
      return;
    }

    // jinak uložit
    await fetch(`${API_BASE}/api/saved-community-recipes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipeId: rid }),
    });

    setSavedCommunityIds((p) => (p.includes(rid) ? p : [...p, rid]));
  }

  const selectedIsSaved = selectedRecipe
    ? savedCommunityIds.includes(selectedRecipe?._id)
    : false;

  return (
    <div className="explore">
      <h2>EXPLORE RECIPES</h2>

      <div className="searchAndViews">
        {/*}
        <div className="views">
          <button type="button">GRID VIEW</button>
          <button type="button" disabled>
            SWIPE VIEW
          </button>
        </div>*/}

        <input
          type="text"
          placeholder="Search recipes..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="eploreinput"
        />
        <button
          className="searchButton"
          type="button"
          onClick={() => setDebouncedQ(q.trim())}
          disabled={loading}
        >
          <i className="fas fa-search"></i> Search
        </button>
      </div>

      {err && (
        <p style={{ color: "tomato", marginTop: 8, whiteSpace: "pre-wrap" }}>
          {err}
        </p>
      )}
      {loading && (
        <p style={{ opacity: 0.8, marginTop: 8 }}>Loading recipes…</p>
      )}
      {!loading && !err && items.length === 0 && (
        <p style={{ opacity: 0.8, marginTop: 8 }}>
          No results found. Try a different keyword.
        </p>
      )}
      <section className="variantsExplore">
        <ul>
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
              href="#recommended"
              onClick={(e) => {
                e.preventDefault();
                setSortBy("easiest");
                recommendedRecipes();
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

      <div className="recipeContainer1">
        {displayRecipes.map((r) => {
          const { url, isVideo } = getCover(r);
          const title = r?.title || "Untitled";
          const rating = Math.max(0, Math.round(r?.rating || 0));
          return (
            <div className="recipeCard1" key={r?._id || `${title}-${url}`}>
              <a href="#forNow" title={title}>
                {isVideo ? (
                  <video
                    onClick={() => openModal(r)}
                    src={url}
                    preload="metadata"
                    playsInline
                    muted
                    loop
                    autoPlay
                    style={{
                      width: "100%",
                      height: 200,
                      objectFit: "cover",
                      borderRadius: 8,
                    }}
                  />
                ) : (
                  <img
                    onClick={() => openModal(r)}
                    src={url || PLACEHOLDER_IMG}
                    alt={title}
                    loading="lazy"
                    style={{ width: "100%", height: 200, objectFit: "cover" }}
                    onError={(e) => {
                      e.currentTarget.src = PLACEHOLDER_IMG;
                    }}
                  />
                )}
              </a>
              <h3>{title}</h3>
              <StarRating
                value={
                  typeof r?.ratingAvg === "number"
                    ? r.ratingAvg
                    : r?.rating || 0
                }
                readOnly
                showValue
                count={r?.ratingCount}
              />
              <p>Difficulty: {r?.difficulty || "—"}</p>
              <p>Time: {r?.time || "—"} ⏱️</p>
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
            <button
              className={`saveFloatingBtn ${selectedIsSaved ? "active" : ""}`}
              onClick={() => toggleSaveExplore(selectedRecipe)}
            >
              {selectedIsSaved ? "SAVED" : "SAVE"}
            </button>

            <div id="forNow">
              <div className="nameAndPicture">
                <h2>{selectedRecipe.title}</h2>
                {isVideoSelected ? (
                  <video
                    onClick={() => openModal(r)}
                    src={ThumbnailUrl || PLACEHOLDER_IMG}
                    preload="metadata"
                    playsInline
                    muted
                    loop
                    autoPlay
                  />
                ) : (
                  <img
                    onClick={() => openModal(r)}
                    src={ThumbnailUrl || PLACEHOLDER_IMG}
                    alt={selectedRecipe.title}
                    loading="lazy"
                  />
                )}
              </div>

              <div className="displayIngredience">
                <ol>
                  {selectedRecipe.ingredients.map((ingredient, index) => {
                    return (
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
                  communityRecipeId: selectedRecipe?._id,
                }}
              >
                <button className="getStarted">GET STARTED</button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {total > 0 && (
        <div className="exploreInfo">
          Showing {displayRecipes.length} of {total}
        </div>
      )}

      {page < pages && (
        <div className="explorePages">
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
};

export default ExploreRecipes;
