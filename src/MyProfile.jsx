import { useEffect, useMemo, useState } from "react";
import "./MyRecipes.css";
import { Link } from "react-router-dom";
import { deleteMyRecipe } from "./api"; // ⬅️ nahoře

// 🌍 backend base (stejný pattern jako v exploreRecipes.jsx)
const DEPLOYED_BACKEND_URL = "https://stressfreecheff-backend.onrender.com";
const RAW_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  DEPLOYED_BACKEND_URL;
const API_BASE = String(RAW_BASE || "").replace(/\/+$/, "");

// endpoint pro moje soukromé recepty
const API_URL = `${API_BASE}/api/my-recipes`;

// stejné pomocné funkce jako v exploreRecipes.jsx
const PLACEHOLDER_IMG = "https://i.imgur.com/CZaFjz2.png";
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

const MyProfile = ({ userInfo, addItem }) => {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  //Mazání
  const handleDelete = async (recipeId) => {
    if (!window.confirm("Do you really want to delete this recipe?")) return;
    try {
      await deleteMyRecipe(recipeId);
      // smaž ho z lokálního seznamu
      setItems((prev) => prev.filter((r) => r._id !== recipeId));
      setTotal((t) => t - 1);
    } catch (err) {
      alert("Deletion failed: " + (err?.message || err));
    }
  };

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

  // debounce vyhledávání
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // fetch mých receptů (vyžaduje token)
  useEffect(() => {
    let aborted = false;
    const fetchMine = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setItems([]);
        setTotal(0);
        setPages(1);
        return;
      }

      setLoading(true);
      setErr("");

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (debouncedQ) params.set("q", debouncedQ); // ready pro budoucí BE filter

      try {
        const res = await fetch(`${API_URL}?${params.toString()}`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        const raw = await res.text();
        if (!res.ok)
          throw new Error(`HTTP ${res.status}: ${raw.slice(0, 200)}`);
        const data = JSON.parse(raw);

        if (aborted) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(Number(data.total) || 0);
        setPages(Number(data.pages) || 1);
      } catch (e) {
        if (!aborted) setErr(e?.message || "Failed to load recipes.");
      } finally {
        if (!aborted) setLoading(false);
      }
    };
    fetchMine();
    return () => {
      aborted = true;
    };
  }, [page, limit, debouncedQ]);

  // reset page při změně hledání
  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const canPrev = useMemo(() => page > 1, [page]);
  const canNext = useMemo(() => page < pages, [page, pages]);

  if (!userInfo) return <div>Loading...</div>;

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/AuthForm";
  };

  return (
    <div className="myProfile">
      <div className="loginInfo">
        <h2>Welcome, {userInfo.username}!</h2>
        <h2>Email: {userInfo.email}</h2>
        <button onClick={handleLogout}>Logout</button>
      </div>

      <div className="My">
        {/* SAVED RECIPES – zatím placeholder / budoucí feature 
        <div className="savedRecipes">
          <div className="MyRecipeNewRecipe">
            <h2 className="MyCategory">SAVED RECIPES</h2>
          </div>
          <div className="recipeContainer2">
            <div className="recipeCard2">
              <div>
                <a href="#forNow">
                  <img src="https://i.imgur.com/EZtSp3M.png" />
                </a>
              </div>
              <div className="texto">
                <h3>Coming soon</h3>
                <p>Rating: –</p>
                <p>Difficulty: –</p>
                <p>Time: –</p>
              </div>
            </div>
          </div>
        </div>
        */}

        {/* MY RECIPES – skutečná data z /api/my-recipes */}
        <div className="myRecipes">
          <div className="MyRecipeNewRecipe" style={{ gap: 12 }}>
            <h2 className="MyCategory">MY RECIPES</h2>
          </div>

          {err && (
            <p
              style={{ color: "tomato", marginTop: 8, whiteSpace: "pre-wrap" }}
            >
              {err}
            </p>
          )}
          {loading && <p style={{ opacity: 0.8, marginTop: 8 }}>Loading…</p>}
          {!loading && !err && items.length === 0 && (
            <p style={{ opacity: 0.8, marginTop: 8 }}>
              You don’t have any recipes yet. Add your first one!
            </p>
          )}

          <div className="recipeContainer2">
            {items.map((r) => {
              const { url, isVideo } = getCover(r); // stejná logika jako Explore
              const title = r?.title || "Untitled";
              const rating = Math.max(0, Math.round(r?.rating || 0));
              return (
                <div className="recipeCard2" key={r?._id}>
                  <a href="#forNow" title={title}>
                    {isVideo ? (
                      <video
                        src={url}
                        onClick={() => openModal(r)}
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
                        src={url || PLACEHOLDER_IMG}
                        onClick={() => openModal(r)}
                        alt={title}
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: 200,
                          objectFit: "cover",
                        }}
                        onError={(e) => {
                          e.currentTarget.src = PLACEHOLDER_IMG;
                        }}
                      />
                    )}
                  </a>
                  <div className="texto">
                    <h3 title={title}>{title}</h3>
                    <p>Rating: {rating ? "⭐".repeat(rating) : "–"}</p>
                    <p>Difficulty: {r?.difficulty || "—"}</p>
                    <p>Time: {r?.time || "—"} ⏱️</p>
                  </div>
                  <img
                    src="https://i.imgur.com/aRJEINp.png"
                    className="deleteButton"
                    onClick={() => handleDelete(r._id)}
                  />
                </div>
              );
            })}
          </div>

          {selectedRecipe && (
            <div
              className="modalOverlay"
              onClick={() => setSelectedRecipe(null)}
            >
              <div
                className="selectedRecipeContainer"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
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
                  <Link to="/Recipe" state={{ recipe: selectedRecipe }}>
                    <button className="getStarted">GET STARTED</button>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {(pages > 1 || total > limit) && (
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 16,
              }}
            >
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!canPrev}
              >
                ◀︎ Previous
              </button>
              <span>
                Page {page} / {pages} · {total} results
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={!canNext}
              >
                Next ▶︎
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyProfile;
