import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MdAddShoppingCart } from "react-icons/md";
import { useShopping } from "../context/ShoppingContext";
import { getScaledIngredients } from "../utils/recipeScaling";

const PLACEHOLDER_IMG = "https://i.imgur.com/CZaFjz2.png";

function getMediaUrl(recipe) {
  return recipe?.image?.url || recipe?.imgSrc || PLACEHOLDER_IMG;
}

function isVideoMedia(recipe) {
  const fmt = (recipe?.image?.format || "").toLowerCase().trim();
  const url = recipe?.image?.url || "";
  return (
    ["mp4", "webm", "mov", "m4v"].includes(fmt) ||
    /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url)
  );
}

/**
 * Shared recipe modal used by Home, ExploreRecipes and MyProfile.
 *
 * Props:
 *   recipe          – recipe object (required)
 *   onClose         – () => void (required)
 *   communityRecipeId – string | undefined (passed to Recipe route state)
 *   isSaved         – boolean (shows SAVE/SAVED button when provided)
 *   onToggleSave    – (recipe) => void (required when isSaved is used)
 */
const RecipeModal = ({ recipe, onClose, communityRecipeId, isSaved, onToggleSave }) => {
  const { addItem } = useShopping();

  const baseServings = Number(recipe?.servings) > 0 ? Number(recipe.servings) : 1;
  const [selectedServings, setSelectedServings] = useState(baseServings);

  const scaledIngredients = useMemo(
    () => getScaledIngredients(recipe, selectedServings),
    [recipe, selectedServings],
  );

  const mediaUrl = getMediaUrl(recipe);
  const isVideo = isVideoMedia(recipe);
  const hasSaveButton = onToggleSave !== undefined;

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div
        className="selectedRecipeContainer"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {hasSaveButton ? (
            <button
              className={`saveFloatingBtn ${isSaved ? "active" : ""}`}
              onClick={() => onToggleSave(recipe)}
            >
              {isSaved ? "SAVED" : "SAVE"}
            </button>
          ) : (
            <span />
          )}
          <button classname="close" onClick={onClose}>
            X
          </button>
        </div>

        <div id="modal">
          <div className="nameAndPicture">
            <h2>{recipe.title}</h2>
            {isVideo ? (
              <video
                src={mediaUrl}
                preload="metadata"
                playsInline
                muted
                loop
                autoPlay
              />
            ) : (
              <img
                src={mediaUrl}
                alt={recipe.title}
                onError={(e) => {
                  e.currentTarget.src = PLACEHOLDER_IMG;
                }}
              />
            )}
          </div>

          <div className="displayIngredience">
            <div className="servingsBar">
              <span>Servings:</span>
              <button
                type="button"
                onClick={() => setSelectedServings((p) => Math.max(1, p - 1))}
              >
                -
              </button>
              <span>{selectedServings}</span>
              <button
                type="button"
                onClick={() => setSelectedServings((p) => p + 1)}
              >
                +
              </button>
              <span className="baseServingsInfo">
                Original recipe: {baseServings}
              </span>
            </div>

            <ol>
              {scaledIngredients.map((ingredient, index) => (
                <li key={index} className="ingredient">
                  {ingredient}
                  <button
                    className="sendToList"
                    onClick={() => addItem({ text: ingredient, shop: [] })}
                  >
                    <MdAddShoppingCart size={18} color="#ffffff" />
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div id="startparent">
          <Link to="/Recipe" state={{ recipe, communityRecipeId }}>
            <button className="getStarted">GET STARTED</button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RecipeModal;
