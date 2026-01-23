import React, { useState } from "react";
import "./NewRecipe.css";

import {
  createMyRecipe,
  publishMyRecipe,
  uploadRecipeMedia,
  uploadStepMedia,
} from "./api";

const DIFFICULTIES = ["Beginner", "Intermediate", "Hard"];

const NewRecipe = () => {
  /* -----------------------------
     States
  ----------------------------- */
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState("Beginner");
  const [time, setTime] = useState("00:00");
  const [isPublic, setIsPublic] = useState(false);

  const [thumbFile, setThumbFile] = useState(null);
  const [thumbPreview, setThumbPreview] = useState(null);
  const [thumbIsVideo, setThumbIsVideo] = useState(false);

  const [ingredients, setIngredients] = useState([""]);

  const [steps, setSteps] = useState([
    {
      description: "",
      file: null,
      preview: null,
      type: "text",
      timerH: "",
      timerM: "",
      timerS: "",
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const [aiMode, setAiMode] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiImportErr, setAiImportErr] = useState(null);

  /* =============================
     Handlers
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

  function updateIngredient(index, value) {
    setIngredients((arr) => arr.map((v, i) => (i === index ? value : v)));
  }

  function addIngredient() {
    setIngredients((arr) => [...arr, ""]);
  }

  function removeIngredient(index) {
    setIngredients((arr) => arr.filter((_, i) => i !== index));
  }

  function updateStepDescription(index, value) {
    setSteps((arr) =>
      arr.map((s, i) => (i === index ? { ...s, description: value } : s)),
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
          : s,
      ),
    );
  }

  function addStep() {
    setSteps((arr) => [
      ...arr,
      {
        description: "",
        file: null,
        preview: null,
        type: "text",
        timerH: "",
        timerM: "",
        timerS: "",
      },
    ]);
  }

  function removeStep(index) {
    setSteps((arr) => arr.filter((_, i) => i !== index));
  }

  function clampInt(n, min, max) {
    if (Number.isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function normalizeTimerField(val, max) {
    if (val === "") return "";
    const n = clampInt(parseInt(val, 10), 0, max);
    return String(n).padStart(2, "0");
  }

  function timerPartsToSeconds(step) {
    const hRaw = (step.timerH || "").trim();
    const mRaw = (step.timerM || "").trim();
    const sRaw = (step.timerS || "").trim();

    if (!hRaw && !mRaw && !sRaw) return 0;

    const h = clampInt(parseInt(hRaw || "0", 10), 0, 99);
    const m = clampInt(parseInt(mRaw || "0", 10), 0, 59);
    const s = clampInt(parseInt(sRaw || "0", 10), 0, 59);

    return h * 3600 + m * 60 + s;
  }

  function secondsToParts(totalSeconds) {
    const total = clampInt(
      parseInt(totalSeconds || 0, 10),
      0,
      99 * 3600 + 59 * 60 + 59,
    );

    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;

    return {
      timerH: h ? String(h).padStart(2, "0") : "",
      timerM: m ? String(m).padStart(2, "0") : "",
      timerS: s ? String(s).padStart(2, "0") : "",
    };
  }

  function updateStepTimerPart(index, part, value) {
    setSteps((arr) =>
      arr.map((s, i) => {
        if (i !== index) return s;

        if (part === "timerH")
          return { ...s, timerH: normalizeTimerField(value, 99) };
        if (part === "timerM")
          return { ...s, timerM: normalizeTimerField(value, 59) };
        if (part === "timerS")
          return { ...s, timerS: normalizeTimerField(value, 59) };

        return s;
      }),
    );
  }

  function validateAiRecipeInput(parsed) {
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "Expected a JSON object." };
    }

    if (!parsed.title || typeof parsed.title !== "string") {
      return { ok: false, error: "Missing title." };
    }

    if (!parsed.time || typeof parsed.time !== "string") {
      return { ok: false, error: 'Missing time (format "HH:MM").' };
    }

    if (!Array.isArray(parsed.ingredients) || parsed.ingredients.length === 0) {
      return { ok: false, error: "Missing ingredients (at least one item)." };
    }

    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      return { ok: false, error: "Missing steps (at least one step)." };
    }

    // difficulty is optional, but if present must be valid
    if (parsed.difficulty && !DIFFICULTIES.includes(parsed.difficulty)) {
      return {
        ok: false,
        error: 'difficulty must be "Beginner" | "Intermediate" | "Hard".',
      };
    }

    return { ok: true, data: parsed };
  }

  async function handleCopyAiPrompt() {
    const prompt = `Please rewrite the following recipe into the structured JSON format below:

{
  "title": "Recipe title",
  "difficulty": "Beginner",
  "time": "00:20",
  "ingredients": [
    "Ingredient 1",
    "Ingredient 2"
  ],
  "steps": [
    { "description": "Step 1 description", "timerSeconds": 120 },
    { "description": "Step 2 description", "timerSeconds": 90 }
  ]
}

REQUIREMENTS:
- Title, ingredients and steps may be in the user’s language.
- ⚠️ The "difficulty" field must NEVER be translated. It must be exactly one of:
  "Beginner", "Intermediate", "Hard".
- Leave "time" in HH:MM.
- "steps" must be an array. Each step must contain "description" and optional "timerSeconds".
- Respond ONLY with clean JSON, no explanation.

Here is the recipe:`;

    try {
      await navigator.clipboard.writeText(prompt);
      setMsg({ type: "success", text: "AI prompt copied to clipboard." });
    } catch {
      setMsg({ type: "error", text: "Clipboard blocked (copy failed)." });
    }
  }

  function importFromAiJson(raw) {
    setAiImportErr(null);

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setAiImportErr("Text is not valid JSON.");
      return;
    }

    const validated = validateAiRecipeInput(parsed);
    if (!validated.ok) {
      setAiImportErr(validated.error);
      return;
    }

    const data = validated.data;

    setTitle(String(data.title || "").trim());
    setDifficulty(
      data.difficulty && DIFFICULTIES.includes(data.difficulty)
        ? data.difficulty
        : "Beginner",
    );
    setTime(String(data.time || "").trim());

    setIngredients(
      (data.ingredients || [])
        .map((i) => String(i || "").trim())
        .filter(Boolean),
    );

    setSteps(
      (data.steps || [])
        .map((st) => {
          const description = String(st.description || "").trim();
          const parts = secondsToParts(st.timerSeconds || 0);

          return {
            description,
            file: null,
            preview: null,
            type: "text",
            ...parts,
          };
        })
        .filter((s) => s.description),
    );
  }

  /* =============================
     Validation
  ============================= */
  function validate() {
    if (!title.trim() || !difficulty || !time.trim()) {
      return "Fill in Title, Difficulty and Time.";
    }

    const hasTextStep = steps.some(
      (s) => (s.description || "").trim().length > 0,
    );

    if (!hasTextStep) {
      return "Add at least one step description.";
    }

    for (const s of steps) {
      const any =
        (s.timerH || "").trim() ||
        (s.timerM || "").trim() ||
        (s.timerS || "").trim();
      if (!any) continue;

      const h = parseInt((s.timerH || "0").trim() || "0", 10);
      const m = parseInt((s.timerM || "0").trim() || "0", 10);
      const sec = parseInt((s.timerS || "0").trim() || "0", 10);

      if ([h, m, sec].some((n) => Number.isNaN(n))) {
        return "Timer must be numeric (HH:MM:SS).";
      }
      if (h < 0 || h > 99 || m < 0 || m > 59 || sec < 0 || sec > 59) {
        return "Timer out of range (h 0-99, m/s 0-59).";
      }
    }

    return null;
  }

  /* =============================
     Submit
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

      const payload = {
        title: title.trim(),
        difficulty,
        time: time.trim(),
        ingredients: ingredients.map((i) => i.trim()).filter(Boolean),
        steps: steps
          .map((s) => {
            const description = s.description.trim();
            const timerSeconds = timerPartsToSeconds(s);

            const out = { type: "text", description };
            if (timerSeconds > 0) out.timerSeconds = timerSeconds;

            return out;
          })
          .filter((s) => s.description),

        isPublic: false,
      };

      const created = await createMyRecipe(payload);
      const recipeId = created._id;

      if (thumbFile) {
        await uploadRecipeMedia(recipeId, thumbFile);
      }

      await Promise.all(
        steps.map((s, idx) =>
          s.file ? uploadStepMedia(recipeId, idx, s.file) : null,
        ),
      );

      if (isPublic) {
        await publishMyRecipe(recipeId);
      }

      setMsg({
        type: "success",
        text: `Recipe created${isPublic ? " and shared publicly" : ""}.`,
      });

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
    setSteps([
      {
        description: "",
        file: null,
        preview: null,
        type: "text",
        timerH: "",
        timerM: "",
        timerS: "",
      },
    ]);

    setAiText("");
    setAiImportErr(null);
    setAiMode(false);
  }

  /* =============================
     Render
  ============================= */
  return (
    <div className="new">
      {msg && <p className={msg.type}>{msg.text}</p>}

      <div className="creation">
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
            <div className="inputAdd">
              <label>Recipe visibility</label>
              <select
                value={isPublic ? "Public" : "Private"}
                onChange={(e) => setIsPublic(e.target.value === "Public")}
              >
                <option>Public</option>
                <option>Private</option>
              </select>
            </div>
          </div>

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
        </div>

        <div className="AiImportBox">
          <div className="AiImportHeader">
            <h4>Cook with AI</h4>

            <label className="AiToggle">
              <span>Enable</span>
              <input
                type="checkbox"
                checked={aiMode}
                onChange={(e) => setAiMode(e.target.checked)}
              />
            </label>
          </div>

          {aiMode && (
            <>
              <p className="AiHint">1) Copy the prompt</p>
              <p className="AiHint">• 2) paste your recipe into AI</p>
              <p className="AiHint">• 3) paste returned JSON here </p>
              <p className="AiHint">
                • 4) Import
                <br />
              </p>

              <div className="AiButtonsRow">
                <button
                  type="button"
                  className="AiImportBtn"
                  onClick={handleCopyAiPrompt}
                >
                  Copy AI prompt
                </button>

                <button
                  type="button"
                  className="AiImportBtn"
                  onClick={() => importFromAiJson(aiText)}
                >
                  Import JSON
                </button>
              </div>

              {aiImportErr ? <p className="error">{aiImportErr}</p> : null}

              <textarea
                className="AiImportTextarea"
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                placeholder="Paste the JSON text from AI here..."
              />
            </>
          )}
        </div>

        <div className="stepsAndIngrents">
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

          <div className="Steps">
            <h3>STEPS</h3>
            <ol>
              {steps.map((step, index) => (
                <li key={index}>
                  <label htmlFor={`step-${index}`}>
                    <div className="uploadContainer1">
                      <div className="imagePreview">
                        {step.preview ? (
                          step.type === "video" ? (
                            <video src={step.preview} autoPlay loop muted />
                          ) : (
                            <img src={step.preview} alt="Step preview" />
                          )
                        ) : (
                          <p>Upload Step Media</p>
                        )}
                      </div>
                    </div>
                  </label>

                  <input
                    id={`step-${index}`}
                    type="file"
                    accept="image/*,video/*"
                    hidden
                    onChange={(e) => handleStepFileChange(index, e)}
                  />

                  <textarea
                    value={step.description}
                    onChange={(e) =>
                      updateStepDescription(index, e.target.value)
                    }
                    placeholder="Describe the step…"
                  />

                  <div className="StepTimerRow">
                    <label className="StepTimerLabel">
                      Timer (optional, HH:MM:SS)
                    </label>

                    <div className="StepTimerFields">
                      <div className="StepTimerField">
                        <span className="HMS">h</span>
                        <input
                          value={step.timerH}
                          onChange={(e) =>
                            updateStepTimerPart(index, "timerH", e.target.value)
                          }
                          placeholder="00"
                          inputMode="numeric"
                        />
                      </div>

                      <div className="StepTimerField">
                        <span className="HMS">m</span>
                        <input
                          value={step.timerM}
                          onChange={(e) =>
                            updateStepTimerPart(index, "timerM", e.target.value)
                          }
                          placeholder="00"
                          inputMode="numeric"
                        />
                      </div>

                      <div className="StepTimerField">
                        <span className="HMS">s</span>
                        <input
                          value={step.timerS}
                          onChange={(e) =>
                            updateStepTimerPart(index, "timerS", e.target.value)
                          }
                          placeholder="00"
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                  </div>

                  {steps.length > 1 && (
                    <button onClick={() => removeStep(index)}>X</button>
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
        <div className="sendButtonContainer">
          <img
            className="addRecipe"
            src="https://i.imgur.com/wPktOjd.png"
            alt="Create"
            style={{ opacity: saving ? 0.6 : 1 }}
            onClick={() => (!saving ? handleSubmit() : null)}
          />
        </div>
      </div>
    </div>
  );
};

export default NewRecipe;
