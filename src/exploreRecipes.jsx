import React, { useEffect, useMemo, useRef, useState } from "react";
import "./exploreRecipes.css";
import { Link } from "react-router-dom";
import StarRating from "./StarRating";
import { MdAddShoppingCart } from "react-icons/md";

/* -----------------------------
   API config
----------------------------- */
const DEPLOYED_BACKEND_URL = "https://stressfreecheff-backend.onrender.com";
const RAW_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  DEPLOYED_BACKEND_URL;

const API_BASE = String(RAW_BASE || "").replace(/\/+$/, "");
const API_URL = `${API_BASE}/api/community-recipes`;

const PLACEHOLDER_IMG = "https://i.imgur.com/CZaFjz2.png";

function getToken() {
  return localStorage.getItem("token");
}

/* -----------------------------
   Helpers
----------------------------- */
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

const hash = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const randomSort = (list, seed) =>
  [...list].sort((a, b) => {
    const ida = String(a?._id || "");
    const idb = String(b?._id || "");
    return hash(seed + ida) - hash(seed + idb);
  });

/* -----------------------------
   Component
----------------------------- */
const ExploreRecipes = ({ addItem }) => {
  /* -----------------------------
     States
  ----------------------------- */
  const [items, setItems] = useState([]);
  const [displayRecipes, setDisplayRecipes] = useState([]);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [sortBy, setSortBy] = useState("newest");
  const [randomSeed, setRandomSeed] = useState(() => String(Date.now()));

  const [page, setPage] = useState(1);
  const limit = 14;

  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [savedCommunityIds, setSavedCommunityIds] = useState([]);

  const [selectedRecipe, setSelectedRecipe] = useState(null);

  /* -----------------------------
     Refs (infinite scroll)
  ----------------------------- */
  const loadMoreRef = useRef(null);
  const fetchingMoreRef = useRef(false);

  /* -----------------------------
     Extra
  ----------------------------- */
  const selectedIsSaved = selectedRecipe
    ? savedCommunityIds.includes(selectedRecipe?._id)
    : false;

  const selectedMedia = useMemo(() => {
    if (!selectedRecipe) return { url: PLACEHOLDER_IMG, isVideo: false };
    return getCover(selectedRecipe);
  }, [selectedRecipe]);

  function openModal(recipe) {
    setSelectedRecipe(recipe);
  }

  async function toggleSaveExplore(recipe) {
    if (!recipe?._id) return;

    const rid = recipe._id;
    const token = getToken();

    if (!token) {
      alert("Please login to save recipes.");
      return;
    }

    if (savedCommunityIds.includes(rid)) {
      await fetch(`${API_BASE}/api/saved-community-recipes/${rid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      setSavedCommunityIds((p) => p.filter((id) => id !== rid));
      return;
    }

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
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    (async () => {
      try {
        const token = getToken();
        if (!token) {
          setSavedCommunityIds([]);
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

        const ids = arr.map((r) => r?.recipeId || r?._id).filter(Boolean);

        setSavedCommunityIds(ids);
      } catch {
        setSavedCommunityIds([]);
      }
    })();
  }, []);

  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [debouncedQ, sortBy]);

  useEffect(() => {
    let aborted = false;

    const fetchData = async () => {
      setLoading(true);
      setErr("");

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("sort", sortBy);
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

        setItems((prev) => (page === 1 ? newItems : [...prev, ...newItems]));
      } catch (e) {
        if (!aborted) setErr(e?.message || "Failed to load recipes.");
      } finally {
        if (!aborted) setLoading(false);
        fetchingMoreRef.current = false;
      }
    };

    fetchData();
    return () => {
      aborted = true;
    };
  }, [page, limit, debouncedQ, sortBy]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;

        if (loading) return;
        if (page >= pages) return;
        if (fetchingMoreRef.current) return;

        fetchingMoreRef.current = true;
        setPage((p) => p + 1);
      },
      { root: null, rootMargin: "200px", threshold: 0.01 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [loading, page, pages]);

  useEffect(() => {
    if (sortBy === "random") {
      setDisplayRecipes(randomSort(items, randomSeed));
    } else {
      setDisplayRecipes(items);
    }
  }, [items, sortBy, randomSeed]);

  /* -----------------------------
     Render
  ----------------------------- */
  return (
    <div className="explore">
      <h2>EXPLORE RECIPES</h2>

      <div className="searchAndViews">
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
                setRandomSeed(String(Date.now()));
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

          return (
            <div className="recipeCard1" key={r?._id || `${title}-${url}`}>
              <a href="#modal" title={title}>
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

      <div ref={loadMoreRef} style={{ height: 1 }} />

      {selectedRecipe && (
        <div className="modalOverlay" onClick={() => setSelectedRecipe(null)}>
          <div
            className="selectedRecipeContainer"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={`saveFloatingBtn ${selectedIsSaved ? "active" : ""}`}
              onClick={() => toggleSaveExplore(selectedRecipe)}
            >
              {selectedIsSaved ? "SAVED" : "SAVE"}
            </button>

            <div id="modal">
              <div className="nameAndPicture">
                <h2>{selectedRecipe.title}</h2>

                {selectedMedia.isVideo ? (
                  <video
                    src={selectedMedia.url || PLACEHOLDER_IMG}
                    preload="metadata"
                    playsInline
                    muted
                    loop
                    autoPlay
                  />
                ) : (
                  <img
                    src={selectedMedia.url || PLACEHOLDER_IMG}
                    alt={selectedRecipe.title}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = PLACEHOLDER_IMG;
                    }}
                  />
                )}
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
                  communityRecipeId: selectedRecipe?._id,
                }}
              >
                <button className="getStarted">GET STARTED</button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExploreRecipes;
