import React, { useState } from "react";
import {
  createMyRecipe,
  publishMyRecipe,
  uploadRecipeMedia,
  deleteRecipeMedia,
  uploadStepMedia,
  deleteStepMedia,
} from "./api";
import "./NewRecipe.css";

const DIFFICULTIES = ["Beginner", "Intermediate", "Hard"];

const NewRecipe = () => {
  // --- hlavní info
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState("Beginner");
  const [time, setTime] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // --- thumbnail (soubor + preview)
  const [thumbFile, setThumbFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isVideo, setIsVideo] = useState(false);

  // --- kroky: popisy + volitelně soubory
  const [steps, setSteps] = useState([
    { description: "", file: null, preview: null }, // file = image/video
  ]);

  // --- ingredience (jednoduché pole)
  const [ingredients, setIngredients] = useState([""]);

  // --- UI stav
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // ------- Handlery: thumbnail ----------
  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setThumbFile(f);
      setPreview(URL.createObjectURL(f));
      setIsVideo(f.type.startsWith("video/")); // 👈 true, pokud je to video
    } else {
      setThumbFile(null);
      setPreview(null);
      setIsVideo(false);
    }
  };

  // ------- Handlery: steps ----------
  const handleStepFileChange = (i, e) => {
    const f = e.target.files?.[0] || null;
    setSteps((arr) =>
      arr.map((s, idx) =>
        idx === i
          ? {
              ...s,
              file: f,
              preview: f ? URL.createObjectURL(f) : null,
              type: f
                ? f.type.startsWith("video/")
                  ? "video"
                  : "image"
                : "text",
            }
          : s
      )
    );
  };

  const updateStepDesc = (i, val) => {
    setSteps((arr) =>
      arr.map((s, idx) => (idx === i ? { ...s, description: val } : s))
    );
  };

  const addStep = () =>
    setSteps((arr) => [...arr, { description: "", file: null, preview: null }]);

  const removeStep = (i) =>
    setSteps((arr) => arr.filter((_, idx) => idx !== i));

  // ------- Ingredience ----------
  const updateIngredient = (i, val) =>
    setIngredients((arr) => arr.map((v, idx) => (idx === i ? val : v)));

  const addIngredient = () => setIngredients((arr) => [...arr, ""]);
  const removeIngredient = (i) =>
    setIngredients((arr) => arr.filter((_, idx) => idx !== i));

  // ------- Submit flow (A2 – jistota public s coverem) ----------
  const handleSubmit = async () => {
    try {
      setMsg(null);

      if (!title.trim() || !difficulty || !time.trim()) {
        setMsg({ type: "error", text: "Fill in Title, Difficulty and Time." });
        return;
      }

      const hasAtLeastOneTextStep = steps.some(
        (s) => (s.description || "").trim().length > 0
      );
      if (!hasAtLeastOneTextStep) {
        setMsg({ type: "error", text: "Add at least one step description." });
        return;
      }

      setSaving(true);

      // 1) Vytvořím recept VŽDY jako PRIVATE (public až po uploadech)
      const payload = {
        title: title.trim(),
        difficulty,
        time: time.trim(), // string ok (např. "00:20")
        imgSrc: undefined, // nepoužíváme, bereme Cloudinary image objekt
        ingredients: ingredients.map((s) => (s || "").trim()).filter(Boolean),
        // textové kroky (media doplníme uploadem; typ a src řeší BE sám)
        steps: steps
          .map((s) => ({
            type: "text",
            description: (s.description || "").trim(),
          }))
          .filter((s) => s.description),
        isPublic: false, // 🔒 důležité
      };

      const created = await createMyRecipe(payload);
      const recipeId = created._id;

      // 2) Nahraju THUMBNAIL, pokud je vybraný (uloží do UserRecipe.image)
      if (thumbFile) {
        await uploadRecipeMedia(recipeId, thumbFile);
      }

      // 3) Nahraju MEDIA KE KROKŮM (každý stepIndex)
      await Promise.all(
        steps.map(async (s, idx) => {
          if (s.file) {
            await uploadStepMedia(recipeId, idx, s.file);
          }
        })
      );

      // 4) Pokud má být PUBLIC -> až TEĎ přepnout (vznikne community kopie s image)
      if (isPublic) {
        await publishMyRecipe(recipeId);
      }

      setMsg({
        type: "success",
        text: `Recipe created${isPublic ? " and shared publicly" : ""}.`,
      });

      // reset
      setTitle("");
      setDifficulty("Beginner");
      setTime("");
      setIsPublic(false);
      setThumbFile(null);
      setPreview(null);
      setIngredients([""]);
      setSteps([{ description: "", file: null, preview: null }]);
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Save failed." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="new">
      {msg && <p className={msg.type}>{msg.text}</p>}

      <div className="mainInfo">
        <div className="nameDifTime">
          <div className="inputAdd">
            <label>
              <p>Name of the Recipe: </p>
            </label>
            <input
              type="text"
              placeholder="Title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="inputAdd">
            <label>
              <p>Difficulty</p>
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="inputAdd">
            <label>
              <p>Time</p>
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        {/* THUMBNAIL: upload + preview */}
        <label htmlFor="uploadID">
          <div className="uploadContainer">
            <div className="imagePreview">
              {preview ? (
                isVideo ? (
                  <video
                    src={preview}
                    muted
                    autoPlay
                    loop
                    style={{
                      maxWidth: "100%",
                      maxHeight: "200px",
                      borderRadius: 8,
                    }}
                  />
                ) : (
                  <img
                    src={preview}
                    alt="Preview"
                    style={{
                      maxWidth: "100%",
                      maxHeight: "200px",
                      borderRadius: 8,
                    }}
                  />
                )
              ) : (
                <p>Upload Recipe Thumbnail</p>
              )}
            </div>

            <input
              id="uploadID"
              className="uploads"
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              hidden
            />
          </div>
        </label>

        {/* “tlačítko” Add Recipe */}
        <img
          className="addRecipe"
          src="https://i.imgur.com/wPktOjd.png"
          alt="Create"
          style={{
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
          onClick={() => (!saving ? handleSubmit() : null)}
        />

        <div className="public">
          <select
            value={isPublic ? "Public" : "Private"}
            onChange={(e) => setIsPublic(e.target.value === "Public")}
          >
            <option>Public</option>
            <option>Private</option>
          </select>
        </div>
      </div>

      <div className="stepsAndIngrents">
        {/* STEPS */}
        <div className="Steps">
          <h3>STEPS</h3>
          <ol>
            {steps.map((s, i) => (
              <li key={i}>
                <input
                  placeholder="Describe the step…"
                  value={s.description}
                  onChange={(e) => updateStepDesc(i, e.target.value)}
                />

                <label htmlFor={`uploadStep-${i}`}>
                  <div className="uploadContainer">
                    <div className="imagePreview">
                      {s.preview ? (
                        s.type === "video" ? (
                          <video
                            src={s.preview}
                            muted
                            autoPlay
                            loop
                            style={{
                              maxWidth: "100%",
                              maxHeight: "200px",
                              borderRadius: 8,
                            }}
                          />
                        ) : (
                          <img
                            src={s.preview}
                            alt="Step preview"
                            style={{
                              maxWidth: "100%",
                              maxHeight: "200px",
                              borderRadius: 8,
                            }}
                          />
                        )
                      ) : (
                        <p>Upload Step Thumbnail (image/video)</p>
                      )}
                    </div>

                    <input
                      id={`uploadStep-${i}`}
                      className="uploads"
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => handleStepFileChange(i, e)}
                      hidden
                    />
                  </div>
                </label>

                {steps.length > 1 && (
                  <button
                    className="X"
                    type="button"
                    onClick={() => removeStep(i)}
                  >
                    X
                  </button>
                )}
              </li>
            ))}

            <li className="addStep">
              <input disabled />
              <div className="photoAndButton">
                <button type="button" onClick={addStep}>
                  Add Step
                </button>
              </div>
            </li>
          </ol>
        </div>

        {/* INGREDIENTS */}
        <div className="Ingredients">
          <h3>INGREDIENTS</h3>
          <ol>
            {ingredients.map((val, i) => (
              <li key={i} className="inputWithButton">
                <input
                  placeholder="e.g., chicken breast"
                  value={val}
                  onChange={(e) => updateIngredient(i, e.target.value)}
                />
                {ingredients.length > 1 && (
                  <button
                    className="X"
                    type="button"
                    onClick={() => removeIngredient(i)}
                  >
                    X
                  </button>
                )}
              </li>
            ))}
            <li className="inputWithButton">
              <button
                className="AddIngredient"
                type="button"
                onClick={addIngredient}
              >
                Add Ingredient
              </button>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default NewRecipe;
