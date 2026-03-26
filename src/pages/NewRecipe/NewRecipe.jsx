import { useState, useEffect } from "react";
import "./NewRecipe.css";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createMyRecipe,
  publishMyRecipe,
  uploadRecipeMedia,
  uploadStepMedia,
  updateMyRecipe,
} from "../../api/myRecipes";
import {
  clampInt,
  secondsToParts,
  timerPartsToSeconds,
  normalizeTimerField,
} from "../../utils/timerUtils";

const DIFFICULTIES = ["Beginner", "Intermediate", "Hard"];

const EMPTY_STEP = {
  description: "",
  file: null,
  preview: null,
  type: "text",
  timerH: "",
  timerM: "",
  timerS: "",
};

const NewRecipe = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const editingRecipe = location.state?.recipe || null;
  const isEditMode = Boolean(editingRecipe);

  /* -- States -- */
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState("Beginner");
  const [time, setTime] = useState("00:00");
  const [isPublic, setIsPublic] = useState(false);

  const [thumbFile, setThumbFile] = useState(null);
  const [thumbPreview, setThumbPreview] = useState(null);
  const [thumbIsVideo, setThumbIsVideo] = useState(false);

  const [ingredients, setIngredients] = useState([""]);
  const [servings, setServings] = useState("1");
  const [steps, setSteps] = useState([{ ...EMPTY_STEP }]);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const [aiMode, setAiMode] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiImportErr, setAiImportErr] = useState(null);

  /* -- Load editing recipe -- */
  useEffect(() => {
    if (!editingRecipe) return;

    setTitle(editingRecipe.title || "");
    setDifficulty(editingRecipe.difficulty || "Beginner");
    setTime(editingRecipe.time || "00:00");
    setServings(
      Number(editingRecipe.servings) > 0 ? String(editingRecipe.servings) : "1",
    );
    setIsPublic(Boolean(editingRecipe.isPublic));
    setIngredients(
      editingRecipe.ingredients?.length ? editingRecipe.ingredients : [""],
    );
    setSteps(
      editingRecipe.steps?.length
        ? editingRecipe.steps.map((s) => ({
            description: s.description || "",
            file: null,
            preview: s.src || null,
            type: s.type || "text",
            ...secondsToParts(s.timerSeconds || 0),
          }))
        : [{ ...EMPTY_STEP }],
    );
  }, [editingRecipe]);

  /* -- Ingredient handlers -- */
  function updateIngredient(index, value) {
    setIngredients((arr) => arr.map((v, i) => (i === index ? value : v)));
  }

  function addIngredient() {
    setIngredients((arr) => [...arr, ""]);
  }

  function removeIngredient(index) {
    setIngredients((arr) => arr.filter((_, i) => i !== index));
  }

  /* -- Step handlers -- */
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

  function updateStepTimerPart(index, part, value) {
    setSteps((arr) =>
      arr.map((s, i) => {
        if (i !== index) return s;
        if (part === "timerH") return { ...s, timerH: normalizeTimerField(value, 99) };
        if (part === "timerM") return { ...s, timerM: normalizeTimerField(value, 59) };
        if (part === "timerS") return { ...s, timerS: normalizeTimerField(value, 59) };
        return s;
      }),
    );
  }

  function addStep() {
    setSteps((arr) => [...arr, { ...EMPTY_STEP }]);
  }

  function removeStep(index) {
    setSteps((arr) => arr.filter((_, i) => i !== index));
  }

  /* -- Thumbnail -- */
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

  /* -- AI import -- */
  function validateAiRecipeInput(parsed) {
    if (!parsed || typeof parsed !== "object")
      return { ok: false, error: "Expected a JSON object." };
    if (
      parsed.servings != null &&
      (!Number.isFinite(Number(parsed.servings)) || Number(parsed.servings) < 1)
    )
      return { ok: false, error: '"servings" must be a number >= 1.' };
    if (!parsed.title || typeof parsed.title !== "string")
      return { ok: false, error: "Missing title." };
    if (!parsed.time || typeof parsed.time !== "string")
      return { ok: false, error: 'Missing time (format "HH:MM").' };
    if (!Array.isArray(parsed.ingredients) || parsed.ingredients.length === 0)
      return { ok: false, error: "Missing ingredients (at least one item)." };
    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0)
      return { ok: false, error: "Missing steps (at least one step)." };
    if (parsed.difficulty && !DIFFICULTIES.includes(parsed.difficulty))
      return { ok: false, error: 'difficulty must be "Beginner" | "Intermediate" | "Hard".' };
    return { ok: true, data: parsed };
  }

  async function handleCopyAiPrompt() {
    const prompt = `Please rewrite the following recipe into the structured JSON format below:

{
  "title": "Recipe title",
  "difficulty": "Beginner",
  "time": "00:20",
  "servings": 2,
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
- Title, ingredients and steps may be in the user's language.
- ⚠️ The "difficulty" field must NEVER be translated. It must be exactly one of:
  "Beginner", "Intermediate", "Hard".
- Leave "time" in HH:MM.
- Include "servings" as a number (for example 1 or 2).
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
    setServings(
      data.servings != null && Number(data.servings) > 0
        ? String(Math.floor(Number(data.servings)))
        : "1",
    );
    setIngredients(
      (data.ingredients || []).map((i) => String(i || "").trim()).filter(Boolean),
    );
    setSteps(
      (data.steps || [])
        .map((st) => ({
          description: String(st.description || "").trim(),
          file: null,
          preview: null,
          type: "text",
          ...secondsToParts(st.timerSeconds || 0),
        }))
        .filter((s) => s.description),
    );
  }

  /* -- Validation -- */
  function validate() {
    if (!title.trim() || !difficulty || !time.trim())
      return "Fill in Title, Difficulty and Time.";
    const servingsNumber = parseInt(servings, 10);
    if (Number.isNaN(servingsNumber) || servingsNumber < 1)
      return "Servings must be at least 1.";
    const hasTextStep = steps.some((s) => (s.description || "").trim().length > 0);
    if (!hasTextStep) return "Add at least one step description.";
    for (const s of steps) {
      const any = (s.timerH || "").trim() || (s.timerM || "").trim() || (s.timerS || "").trim();
      if (!any) continue;
      const h = parseInt((s.timerH || "0").trim() || "0", 10);
      const m = parseInt((s.timerM || "0").trim() || "0", 10);
      const sec = parseInt((s.timerS || "0").trim() || "0", 10);
      if ([h, m, sec].some((n) => Number.isNaN(n))) return "Timer must be numeric (HH:MM:SS).";
      if (h < 0 || h > 99 || m < 0 || m > 59 || sec < 0 || sec > 59)
        return "Timer out of range (h 0-99, m/s 0-59).";
    }
    return null;
  }

  /* -- Submit -- */
  async function handleSubmit() {
    const error = validate();
    if (error) { setMsg({ type: "error", text: error }); return; }

    try {
      setSaving(true);
      setMsg(null);

      const payload = {
        title: title.trim(),
        difficulty,
        time: time.trim(),
        servings: Math.max(1, parseInt(servings, 10) || 1),
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
        isPublic,
      };

      let recipeId;
      if (isEditMode) {
        const updated = await updateMyRecipe(editingRecipe._id, payload);
        recipeId = updated._id;
      } else {
        const created = await createMyRecipe(payload);
        recipeId = created._id;
      }

      if (thumbFile) await uploadRecipeMedia(recipeId, thumbFile);

      await Promise.all(
        steps.map((s, idx) =>
          s.file ? uploadStepMedia(recipeId, idx, s.file) : null,
        ),
      );

      if (isPublic) await publishMyRecipe(recipeId);

      setMsg({
        type: "success",
        text: `Recipe ${isEditMode ? "updated" : "created"}${isPublic ? " and shared publicly" : ""}.`,
      });

      resetForm();
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Save failed." });
    } finally {
      setSaving(false);
    }

    if (isEditMode) { navigate("/myprofile"); return; }
  }

  function resetForm() {
    setTitle("");
    setDifficulty("Beginner");
    setTime("00:00");
    setServings("1");
    setIsPublic(false);
    setThumbFile(null);
    setThumbPreview(null);
    setThumbIsVideo(false);
    setIngredients([""]);
    setSteps([{ ...EMPTY_STEP }]);
    setAiText("");
    setAiImportErr(null);
    setAiMode(false);
  }

  /* -- Render -- */
  return (
    <div className="new">
      {msg && <p className={msg.type}>{msg.text}</p>}

      <div className="creation">
        <h2>{isEditMode ? "Edit Recipe" : "Create Recipe"}</h2>

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
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="inputAdd">
              <label>Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="inputAdd">
              <label>Servings</label>
              <input
                type="number"
                min="1"
                step="1"
                value={servings}
                onChange={(e) => setServings(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 2"
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
              <p className="AiHint">• 3) paste returned JSON here</p>
              <p className="AiHint">• 4) Import</p>
              <div className="AiButtonsRow">
                <button type="button" className="AiImportBtn" onClick={handleCopyAiPrompt}>
                  Copy AI prompt
                </button>
                <button type="button" className="AiImportBtn" onClick={() => importFromAiJson(aiText)}>
                  Import JSON
                </button>
              </div>
              {aiImportErr && <p className="error">{aiImportErr}</p>}
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
                    onChange={(e) => updateStepDescription(index, e.target.value)}
                    placeholder="Describe the step…"
                  />
                  <div className="StepTimerRow">
                    <label className="StepTimerLabel">
                      Timer (optional, HH:MM:SS)
                    </label>
                    <div className="StepTimerFields">
                      {[
                        { part: "timerH", max: 99, label: "h" },
                        { part: "timerM", max: 59, label: "m" },
                        { part: "timerS", max: 59, label: "s" },
                      ].map(({ part, label }) => (
                        <div key={part} className="StepTimerField">
                          <span className="HMS">{label}</span>
                          <input
                            value={step[part]}
                            onChange={(e) => updateStepTimerPart(index, part, e.target.value)}
                            placeholder="00"
                            inputMode="numeric"
                          />
                        </div>
                      ))}
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
