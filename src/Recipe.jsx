import React, { useEffect, useState } from "react";
import "./Recipe.css";
import { useLocation, Link } from "react-router-dom";
import StarRating from "./StarRating";

const RAW =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "https://stressfreecheff-backend.onrender.com";
const API_BASE = String(RAW || "").replace(/\/+$/, "");

const Recipe = () => {
  const location = useLocation();
  const { recipe } = location.state || {};
  const [currentStep, setCurrentStep] = useState(0);

  if (!recipe || !recipe.steps) {
    return (
      <div>
        <p>Recipe not found</p>
        <Link to="/domov">
          <button>Back to HOME</button>
        </Link>
      </div>
    );
  }

  // 1) community ID může přijít z Explore/MyProfile, nebo jde o community přímo
  const initialCommunityId =
    location?.state?.communityRecipeId ||
    (typeof recipe?.ratingAvg === "number" ||
    typeof recipe?.ratingCount === "number"
      ? recipe?._id
      : null) ||
    recipe?.publicRecipeId ||
    null;

  const [communityId, setCommunityId] = useState(initialCommunityId);
  const [ensuring, setEnsuring] = useState(false);

  // 2) ofiko (Home) → zajistit community kopii
  useEffect(() => {
    const isOfficial =
      !initialCommunityId &&
      typeof recipe?.ratingAvg !== "number" &&
      typeof recipe?.ratingCount !== "number" &&
      recipe?._id;
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
        if (!res.ok) throw new Error(data?.error || "ensure failed");
        if (!aborted) {
          setCommunityId(data._id);
          setCommunity((prev) => ({
            ...prev,
            avg: data.ratingAvg || 0,
            count: data.ratingCount || 0,
          }));
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

  const [myRating, setMyRating] = useState(0);
  const [rateMsg, setRateMsg] = useState(null);
  const [community, setCommunity] = useState({
    avg: Number(recipe?.ratingAvg ?? recipe?.rating ?? 0) || 0,
    count: Number(recipe?.ratingCount ?? 0) || 0,
  });

  const step = recipe.steps[currentStep];
  const canRateCommunity = Boolean(communityId) && !ensuring;

  async function submitRating(intValue) {
    try {
      setRateMsg(null);
      if (!canRateCommunity) {
        setRateMsg({
          type: "error",
          text: "Rating not available for this recipe.",
        });
        return;
      }
      const token = localStorage.getItem("token");
      if (!token) {
        setRateMsg({ type: "error", text: "You must be logged in to rate." });
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
          body: JSON.stringify({ value: intValue }), // 1..5
        }
      );

      const raw = await res.text();
      if (!res.ok) throw new Error(raw || "Failed to rate.");
      const data = JSON.parse(raw);

      setMyRating(intValue);
      setCommunity({ avg: data.ratingAvg, count: data.ratingCount });
      setRateMsg({
        type: "ok",
        text: `Thanks! ★${data.ratingAvg.toFixed(2)} (${data.ratingCount})`,
      });
    } catch (e) {
      setRateMsg({ type: "error", text: e?.message || "Rating failed." });
    }
  }

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
              muted
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

          {currentStep < recipe.steps.length - 1 ? (
            <div className="buttonContainer">
              {currentStep > 0 ? (
                <button
                  className="previousStep"
                  onClick={() => setCurrentStep((p) => p - 1)}
                >
                  PREVIOUS STEP
                </button>
              ) : (
                <span />
              )}
              <button
                className="nextStep"
                onClick={() => setCurrentStep((p) => p + 1)}
              >
                NEXT STEP
              </button>
            </div>
          ) : (
            <div
              className="buttonContainer"
              style={{ display: "block", textAlign: "center" }}
            >
              <div style={{ marginBottom: 10 }}>
                <button
                  className="previousStep"
                  onClick={() => setCurrentStep((p) => Math.max(0, p - 1))}
                >
                  PREVIOUS
                </button>
              </div>

              <p className="completed" style={{ marginBottom: 8 }}>
                RECIPE COMPLETED
              </p>
              <p style={{ margin: "6px 0 8px" }}>Rate this recipe:</p>
              <StarRating
                value={myRating || community.avg}
                onRate={canRateCommunity ? (v) => submitRating(v) : undefined}
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
                    color: rateMsg.type === "ok" ? "limegreen" : "tcdomato",
                  }}
                >
                  {rateMsg.text}
                </p>
              )}

              <div style={{ marginTop: 10 }}>
                <Link to="/domov">
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
