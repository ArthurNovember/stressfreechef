import { useCallback, useEffect, useMemo, useState } from "react";

import "./Recipe.css";
import { useLocation, Link } from "react-router-dom";
import StarRating from "./StarRating";

/* -----------------------------
   API config
----------------------------- */
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "https://stressfreecheff-backend.onrender.com";

/* -----------------------------
   Helpers
----------------------------- */
function getInitialCommunityId(recipe, locationState) {
  if (locationState?.communityRecipeId) return locationState.communityRecipeId;

  if (
    typeof recipe?.ratingAvg === "number" ||
    typeof recipe?.ratingCount === "number"
  ) {
    return recipe?._id || null;
  }

  if (recipe?.publicRecipeId) return recipe.publicRecipeId;

  return null;
}

function getToken() {
  return localStorage.getItem("token");
}

function parseTimerSeconds(step) {
  const raw =
    typeof step?.timerSeconds === "number"
      ? step.timerSeconds
      : Number(step?.timerSeconds ?? 0);

  if (!raw || !Number.isFinite(raw) || raw <= 0) return null;
  return Math.floor(raw);
}

function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

/* -----------------------------
   Component
----------------------------- */
const Recipe = () => {
  const location = useLocation();
  const recipe = location.state?.recipe;

  const [currentStep, setCurrentStep] = useState(0);
  const step = recipe.steps[currentStep];

  //Timer
  const [remaining, setRemaining] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [accumulated, setAccumulated] = useState(0);
  const [justFinished, setJustFinished] = useState(false);

  if (!recipe || !Array.isArray(recipe.steps)) {
    return (
      <div>
        <p>Recipe not found</p>
        <Link to="/home">
          <button>Back to HOME</button>
        </Link>
      </div>
    );
  }

  /* =============================
     Community rating state
  ============================= */
  const initialCommunityId = useMemo(
    () => getInitialCommunityId(recipe, location.state),
    [recipe, location.state]
  );

  const [communityId, setCommunityId] = useState(initialCommunityId);
  const [ensuring, setEnsuring] = useState(false);

  const [community, setCommunity] = useState({
    avg: Number(recipe?.ratingAvg ?? recipe?.rating ?? 0) || 0,
    count: Number(recipe?.ratingCount ?? 0) || 0,
  });

  const [myRating, setMyRating] = useState(0);
  const [rateMsg, setRateMsg] = useState(null);

  const canRateCommunity = Boolean(communityId) && !ensuring;
  const stepTimer = parseTimerSeconds(step);
  const hasTimer = stepTimer != null;

  /* =============================
     Effects
  ============================= */
  useEffect(() => {
    const isOfficial =
      !initialCommunityId &&
      recipe?._id &&
      typeof recipe?.ratingAvg !== "number" &&
      typeof recipe?.ratingCount !== "number";

    if (!isOfficial) return;

    let aborted = false;

    (async () => {
      try {
        setEnsuring(true);

        const res = await fetch(
          `${API_BASE}/api/community-recipes/ensure-from-recipe/${recipe._id}`,
          { method: "POST" }
        );

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Ensure failed");

        if (!aborted) {
          setCommunityId(data._id);
          setCommunity({
            avg: Number(data.ratingAvg || 0),
            count: Number(data.ratingCount || 0),
          });
        }
      } catch (e) {
        console.error("ensure community failed:", e);
      } finally {
        if (!aborted) setEnsuring(false);
      }
    })();

    return () => {
      aborted = true;
    };
  }, [recipe?._id, initialCommunityId]);

  useEffect(() => {
    if (!communityId) return;

    let aborted = false;

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/community-recipes/${communityId}`
        );
        const data = await res.json();

        if (!res.ok)
          throw new Error(data?.error || "Failed to load community stats");

        if (!aborted) {
          setCommunity({
            avg: Number(data.ratingAvg || 0),
            count: Number(data.ratingCount || 0),
          });
        }
      } catch (e) {
        console.warn("Failed to fetch community recipe:", e?.message || e);
      }
    })();

    return () => {
      aborted = true;
    };
  }, [communityId]);

  useEffect(() => {
    if (!step) {
      setRemaining(null);
      setIsRunning(false);
      setStartedAt(null);
      setAccumulated(0);
      setJustFinished(false);
      return;
    }

    if (!hasTimer) {
      setRemaining(null);
      setIsRunning(false);
      setStartedAt(null);
      setAccumulated(0);
      setJustFinished(false);
      return;
    }

    setRemaining(stepTimer);
    setIsRunning(false);
    setStartedAt(null);
    setAccumulated(0);
    setJustFinished(false);
  }, [currentStep, hasTimer, stepTimer, step]);

  useEffect(() => {
    if (!isRunning || startedAt == null || !hasTimer) return;

    const duration = stepTimer;
    const id = setInterval(() => {
      const elapsedSinceStart = (Date.now() - startedAt) / 1000;
      const totalElapsed = accumulated + elapsedSinceStart;
      const nextRemaining = Math.max(0, duration - Math.floor(totalElapsed));

      setRemaining(nextRemaining);

      if (nextRemaining <= 0) {
        setIsRunning(false);
        setStartedAt(null);
        setAccumulated(duration);
        setJustFinished(true);

        // web “vibrace” -> aspoň malý feedback
        // (když chceš, můžeme přidat sound později)
      }
    }, 1000);

    return () => clearInterval(id);
  }, [isRunning, startedAt, accumulated, hasTimer, stepTimer]);

  /* =============================
     Rating
  ============================= */
  async function submitRating(value) {
    try {
      setRateMsg(null);

      if (!canRateCommunity) {
        setRateMsg({
          type: "error",
          text: "Rating not available for this recipe.",
        });
        return;
      }

      const token = getToken();
      if (!token) {
        setRateMsg({
          type: "error",
          text: "You must be logged in to rate.",
        });
        return;
      }

      const res = await fetch(
        `${API_BASE}/api/community-recipes/${communityId}/rate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ value }),
        }
      );

      const raw = await res.text();
      if (!res.ok) throw new Error(raw || "Failed to rate");

      const data = JSON.parse(raw);

      setMyRating(value);
      setCommunity({
        avg: data.ratingAvg,
        count: data.ratingCount,
      });

      setRateMsg({
        type: "ok",
        text: `Thanks! ★${data.ratingAvg.toFixed(2)} (${data.ratingCount})`,
      });
    } catch (e) {
      setRateMsg({ type: "error", text: e?.message || "Rating failed." });
    }
  }

  /* =============================
     Timer
  ============================= */

  const handleStartPause = useCallback(() => {
    if (!hasTimer) return;

    if (!isRunning) {
      setJustFinished(false);

      if (remaining == null || remaining <= 0) {
        setAccumulated(0);
        setRemaining(stepTimer);
      }

      setStartedAt(Date.now());
      setIsRunning(true);
      return;
    }

    // pause
    if (startedAt != null) {
      const elapsedSinceStart = (Date.now() - startedAt) / 1000;
      setAccumulated((acc) => acc + elapsedSinceStart);
    }

    setStartedAt(null);
    setIsRunning(false);
  }, [hasTimer, isRunning, remaining, startedAt, stepTimer]);

  const handleResetTimer = useCallback(() => {
    setIsRunning(false);
    setStartedAt(null);
    setAccumulated(0);
    setJustFinished(false);

    if (hasTimer) setRemaining(stepTimer);
    else setRemaining(null);
  }, [hasTimer, stepTimer]);

  /* =============================
     Render
  ============================= */
  return (
    <div className="Recipe">
      <div
        className="recipeBackground"
        style={{
          backgroundImage: `url(${recipe.image?.url || recipe.imgSrc})`,
        }}
      />

      <div className="imgAndTextRecipe">
        <div className="imgContainer">
          {step.type === "image" ? (
            <img src={step.src} alt="Step" />
          ) : step.type === "video" ? (
            <video
              autoPlay
              loop
              className="recipeVideo"
              src={step.src}
              controls
            />
          ) : (
            <p className="replace">{currentStep + 1}</p>
          )}
        </div>

        <div className="buttonAndStep">
          <h3 className="step">Step {currentStep + 1}</h3>
          <p className="instruction">{step.description}</p>
          {/* ⏱ Timer (web) */}
          {hasTimer && (
            <div className="timerBox">
              <div className="timerCircle">
                <span className="timerValue">
                  {formatTime(remaining != null ? remaining : stepTimer)}
                </span>
              </div>

              {justFinished && <div className="timerFinished">TIMER DONE</div>}

              <div className="timerRow">
                <button
                  type="button"
                  className={`timerBtn ${isRunning ? "active" : ""}`}
                  onClick={handleStartPause}
                >
                  {isRunning ? "❚❚" : "▶"}
                </button>

                <button
                  type="button"
                  className="timerBtn"
                  onClick={handleResetTimer}
                >
                  ■
                </button>
              </div>
            </div>
          )}

          {currentStep < recipe.steps.length - 1 ? (
            <div className="buttonContainer">
              {currentStep > 0 ? (
                <button
                  className="stepButton"
                  onClick={() => setCurrentStep((p) => p - 1)}
                >
                  PREVIOUS
                </button>
              ) : (
                <span />
              )}
              <button
                className="stepButton"
                onClick={() => setCurrentStep((p) => p + 1)}
              >
                NEXT
              </button>
            </div>
          ) : (
            <div className="buttonContainer2">
              <div className="backPrevious">
                <button
                  className="stepButton"
                  onClick={() => setCurrentStep((p) => Math.max(0, p - 1))}
                >
                  PREVIOUS
                </button>

                <StarRating
                  value={myRating || community.avg}
                  onRate={canRateCommunity ? submitRating : undefined}
                  showValue
                  count={community.count}
                  size={28}
                />

                {!canRateCommunity && (
                  <p style={{ marginTop: 6, opacity: 0.85 }}>
                    {ensuring
                      ? "Preparing rating…"
                      : "This recipe cannot be rated."}
                  </p>
                )}

                {rateMsg && (
                  <p
                    style={{
                      marginTop: 8,
                      color: rateMsg.type === "ok" ? "limegreen" : "tomato",
                    }}
                  >
                    {rateMsg.text}
                  </p>
                )}

                <Link to="/home">
                  <button>Back to HOME</button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Recipe;
