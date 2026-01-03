import React, { useState } from "react";
import "./NewRecipe.css";

import {
  createMyRecipe,
  publishMyRecipe,
  uploadRecipeMedia,
  uploadStepMedia,
} from "./api";

/* -----------------------------
   Constants
----------------------------- */
const DIFFICULTIES = ["Beginner", "Intermediate", "Hard"];

/* -----------------------------
   Component
----------------------------- */
const NewRecipe = () => {
  /* -----------------------------
     Main recipe info
  ----------------------------- */
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState("Beginner");
  const [time, setTime] = useState("00:00");
  const [isPublic, setIsPublic] = useState(false);

  /* -----------------------------
     Thumbnail (file + preview)
  ----------------------------- */
  const [thumbFile, setThumbFile] = useState(null);
  const [thumbPreview, setThumbPreview] = useState(null);
  const [thumbIsVideo, setThumbIsVideo] = useState(false);

  /* -----------------------------
     Ingredients
  ----------------------------- */
  const [ingredients, setIngredients] = useState([""]);

  /* -----------------------------
     Steps (description + optional media)
  ----------------------------- */
  const [steps, setSteps] = useState([
    { description: "", file: null, preview: null, type: "text" },
  ]);

  /* -----------------------------
     UI state
  ----------------------------- */
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  /* =============================
     Handlers – Thumbnail
  ============================= */
  function handleThumbnailChange(e) {
    const file = e.target.files?.[0] || null;

    if (!file) {
      setThumbFile(null);
      setThumbPreview(null);
      setThumbIsVideo(false);
      return;
    }

    setThumbFile(file);
    setThumbPreview(URL.createObjectURL(file));
    setThumbIsVideo(file.type.startsWith("video/"));
  }

  /* =============================
     Handlers – Ingredients
  ============================= */
  function updateIngredient(index, value) {
    setIngredients((arr) => arr.map((v, i) => (i === index ? value : v)));
  }

  function addIngredient() {
    setIngredients((arr) => [...arr, ""]);
  }

  function removeIngredient(index) {
    setIngredients((arr) => arr.filter((_, i) => i !== index));
  }

  /* =============================
     Handlers – Steps
  ============================= */
  function updateStepDescription(index, value) {
    setSteps((arr) =>
      arr.map((s, i) => (i === index ? { ...s, description: value } : s))
    );
  }

  function handleStepFileChange(index, e) {
    const file = e.target.files?.[0] || null;

    setSteps((arr) =>
      arr.map((s, i) =>
        i === index
          ? {
              ...s,
              file,
              preview: file ? URL.createObjectURL(file) : null,
              type: file
                ? file.type.startsWith("video/")
                  ? "video"
                  : "image"
                : "text",
            }
          : s
      )
    );
  }

  function addStep() {
    setSteps((arr) => [
      ...arr,
      { description: "", file: null, preview: null, type: "text" },
    ]);
  }

  function removeStep(index) {
    setSteps((arr) => arr.filter((_, i) => i !== index));
  }

  /* =============================
     Validation
  ============================= */
  function validate() {
    if (!title.trim() || !difficulty || !time.trim()) {
      return "Fill in Title, Difficulty and Time.";
    }

    const hasTextStep = steps.some(
      (s) => (s.description || "").trim().length > 0
    );

    if (!hasTextStep) {
      return "Add at least one step description.";
    }

    return null;
  }

  /* =============================
     Submit flow
  ============================= */
  async function handleSubmit() {
    const error = validate();
    if (error) {
      setMsg({ type: "error", text: error });
      return;
    }

    try {
      setSaving(true);
      setMsg(null);

      /* 1️⃣ Create recipe as PRIVATE */
      const payload = {
        title: title.trim(),
        difficulty,
        time: time.trim(),
        ingredients: ingredients.map((i) => i.trim()).filter(Boolean),
        steps: steps
          .map((s) => ({
            type: "text",
            description: s.description.trim(),
          }))
          .filter((s) => s.description),
        isPublic: false,
      };

      const created = await createMyRecipe(payload);
      const recipeId = created._id;

      /* 2️⃣ Upload thumbnail */
      if (thumbFile) {
        await uploadRecipeMedia(recipeId, thumbFile);
      }

      /* 3️⃣ Upload step media */
      await Promise.all(
        steps.map((s, idx) =>
          s.file ? uploadStepMedia(recipeId, idx, s.file) : null
        )
      );

      /* 4️⃣ Publish (optional) */
      if (isPublic) {
        await publishMyRecipe(recipeId);
      }

      setMsg({
        type: "success",
        text: `Recipe created${isPublic ? " and shared publicly" : ""}.`,
      });

      /* 5️⃣ Reset form */
      resetForm();
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setTitle("");
    setDifficulty("Beginner");
    setTime("00:00");
    setIsPublic(false);
    setThumbFile(null);
    setThumbPreview(null);
    setThumbIsVideo(false);
    setIngredients([""]);
    setSteps([{ description: "", file: null, preview: null, type: "text" }]);
  }

  /* =============================
     Render
  ============================= */
  return (
    <div className="new">
      {msg && <p className={msg.type}>{msg.text}</p>}

      <div className="creation">
        {/* MAIN INFO */}
        <div className="mainInfo">
          <div className="nameDifTime">
            <div className="inputAdd">
              <label>Name of the Recipe</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title…"
              />
            </div>

            <div className="inputAdd">
              <label>Difficulty</label>
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
              <label>Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* THUMBNAIL */}
          <div className="uploadContainer">
            <label htmlFor="uploadThumb">
              <div className="imagePreview">
                {thumbPreview ? (
                  thumbIsVideo ? (
                    <video src={thumbPreview} autoPlay loop muted />
                  ) : (
                    <img src={thumbPreview} alt="Preview" />
                  )
                ) : (
                  <p>Upload Recipe Thumbnail</p>
                )}
              </div>
            </label>

            <input
              id="uploadThumb"
              type="file"
              accept="image/*,video/*"
              hidden
              onChange={handleThumbnailChange}
            />
          </div>

          {/* CREATE BUTTON */}
          <img
            className="addRecipe"
            src="https://i.imgur.com/wPktOjd.png"
            alt="Create"
            style={{ opacity: saving ? 0.6 : 1 }}
            onClick={() => (!saving ? handleSubmit() : null)}
          />

          {/* VISIBILITY */}
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

        {/* INGREDIENTS + STEPS */}
        <div className="stepsAndIngrents">
          {/* INGREDIENTS */}
          <div className="Ingredients">
            <h3>INGREDIENTS</h3>
            <ol>
              {ingredients.map((v, i) => (
                <li key={i} className="inputWithButton">
                  <input
                    value={v}
                    onChange={(e) => updateIngredient(i, e.target.value)}
                    placeholder="e.g. chicken breast"
                  />
                  {ingredients.length > 1 && (
                    <button onClick={() => removeIngredient(i)}>X</button>
                  )}
                </li>
              ))}
              <li>
                <button className="AddIngredient" onClick={addIngredient}>
                  Add Ingredient
                </button>
              </li>
            </ol>
          </div>

          {/* STEPS */}
          <div className="Steps">
            <h3>STEPS</h3>
            <ol>
              {steps.map((s, i) => (
                <li key={i}>
                  <label htmlFor={`step-${i}`}>
                    <div className="uploadContainer">
                      <div className="imagePreview">
                        {s.preview ? (
                          s.type === "video" ? (
                            <video src={s.preview} autoPlay loop muted />
                          ) : (
                            <img src={s.preview} alt="Step preview" />
                          )
                        ) : (
                          <p>Upload Step Media</p>
                        )}
                      </div>
                    </div>
                  </label>

                  <input
                    id={`step-${i}`}
                    type="file"
                    accept="image/*,video/*"
                    hidden
                    onChange={(e) => handleStepFileChange(i, e)}
                  />

                  <textarea
                    value={s.description}
                    onChange={(e) => updateStepDescription(i, e.target.value)}
                    placeholder="Describe the step…"
                  />

                  {steps.length > 1 && (
                    <button onClick={() => removeStep(i)}>X</button>
                  )}
                </li>
              ))}

              <li>
                <button className="AddIngredient" onClick={addStep}>
                  Add Step
                </button>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewRecipe;
