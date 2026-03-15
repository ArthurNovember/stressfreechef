const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const authenticateToken = require("../middleware/authenticateToken");
const UserRecipe = require("../models/UserRecipe");
const CommunityRecipe = require("../models/CommunityRecipe");
const cloudinary = require("../utils/cloudinary");

const { parseIngredientList } = require("../utils/ingredientParser");

function validateSteps(steps = []) {
  if (!Array.isArray(steps)) return false;
  for (const s of steps) {
    if (!s || typeof s !== "object") return false;
    if (!["image", "video", "text"].includes(s.type)) return false;
    if ((s.type === "image" || s.type === "video") && !s.src) return false;
    if (!s.description || typeof s.description !== "string") return false;
    if ("timerSeconds" in s && s.timerSeconds != null) {
      if (typeof s.timerSeconds !== "number" || s.timerSeconds < 0) {
        return false;
      }
    }
  }
  return true;
}

function normalizeDifficulty(value) {
  const allowed = ["Beginner", "Intermediate", "Hard"];
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return allowed.includes(trimmed) ? trimmed : null;
}

function normalizeTime(value) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : null;
}

async function syncPublicRecipeFromUserRecipe(userRecipe) {
  if (!userRecipe.publicRecipeId) return;

  await CommunityRecipe.findByIdAndUpdate(userRecipe.publicRecipeId, {
    title: userRecipe.title,
    rating: userRecipe.rating,
    difficulty: userRecipe.difficulty,
    time: userRecipe.time,
    imgSrc: userRecipe.imgSrc,
    image: userRecipe.image,
    ingredients: userRecipe.ingredients,
    steps: userRecipe.steps,
    servings: userRecipe.servings,
    structuredIngredients: userRecipe.structuredIngredients,
    owner: userRecipe.owner,
  });
}

async function createPublicRecipeFromUserRecipe(userRecipe) {
  const publicDoc = await CommunityRecipe.create({
    title: userRecipe.title,
    rating: userRecipe.rating,
    difficulty: userRecipe.difficulty,
    time: userRecipe.time,
    imgSrc: userRecipe.imgSrc,
    image: userRecipe.image,
    ingredients: userRecipe.ingredients,
    steps: userRecipe.steps,
    servings: userRecipe.servings,
    structuredIngredients: userRecipe.structuredIngredients,
    owner: userRecipe.owner,
  });

  userRecipe.publicRecipeId = publicDoc._id;
  await userRecipe.save();
}

async function removePublicRecipeLink(userRecipe) {
  if (!userRecipe.publicRecipeId) return;

  await CommunityRecipe.findByIdAndDelete(userRecipe.publicRecipeId).catch(
    () => {},
  );

  userRecipe.publicRecipeId = null;
  await userRecipe.save();
}

async function destroyCloudinaryAsset(publicId) {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    return;
  } catch {}

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "video" });
    return;
  } catch {}

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
  } catch {}
}

async function deleteRecipeAssets(recipe) {
  if (recipe?.image?.publicId) {
    await destroyCloudinaryAsset(recipe.image.publicId);
  }

  for (const step of recipe.steps || []) {
    if (step?.mediaPublicId) {
      await destroyCloudinaryAsset(step.mediaPublicId);
    }
  }
}

router.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      title,
      rating,
      difficulty,
      time,
      imgSrc,
      ingredients,
      steps,
      servings,
      isPublic,
    } = req.body;

    if (!title || !difficulty || !time) {
      return res
        .status(400)
        .json({ error: "title, difficulty a time jsou povinné." });
    }

    const normalizedDifficulty = normalizeDifficulty(difficulty);
    if (!normalizedDifficulty) {
      return res.status(400).json({
        error: "difficulty musí být Beginner, Intermediate nebo Hard.",
      });
    }

    const normalizedTime = normalizeTime(time);
    if (!normalizedTime) {
      return res.status(400).json({
        error: "time musí být ve formátu HH:MM.",
      });
    }

    if (steps && !validateSteps(steps)) {
      return res.status(400).json({ error: "steps má neplatný formát." });
    }

    const normalizedIngredients = Array.isArray(ingredients)
      ? ingredients.map((i) => String(i).trim()).filter(Boolean)
      : [];

    const parsedServings = Number(servings);
    const safeServings =
      Number.isInteger(parsedServings) && parsedServings > 0
        ? parsedServings
        : 1;

    const structuredIngredients = parseIngredientList(normalizedIngredients);

    const userRec = await UserRecipe.create({
      title: String(title).trim(),
      rating: typeof rating === "number" ? rating : 0,
      difficulty: normalizedDifficulty,
      time: normalizedTime,
      imgSrc: imgSrc ? String(imgSrc) : undefined,
      image: req.body?.image,
      ingredients: normalizedIngredients,
      steps: steps || [],
      servings: safeServings,
      structuredIngredients,
      owner: req.user._id,
      isPublic: !!isPublic,
    });
    if (userRec.isPublic) {
      await createPublicRecipeFromUserRecipe(userRec);
    }

    res.status(201).json(userRec);
  } catch (err) {
    console.error("POST /api/my-recipes error:", err);
    res.status(500).json({ error: "Interní chyba serveru." });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const q = String(req.query.q || "").trim();
    const filter = { owner: req.user._id };
    if (q) filter.title = { $regex: q, $options: "i" };

    const [items, total] = await Promise.all([
      UserRecipe.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      UserRecipe.countDocuments(filter),
    ]);

    res.json({ items, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("GET /api/my-recipes error:", err);
    res.status(500).json({ error: "Interní chyba serveru." });
  }
});

router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ error: "Neplatné ID." });

    const doc = await UserRecipe.findOne({ _id: id, owner: req.user._id });
    if (!doc) return res.status(404).json({ error: "Recept nenalezen." });

    res.json(doc);
  } catch (err) {
    console.error("GET /api/my-recipes/:id error:", err);
    res.status(500).json({ error: "Interní chyba serveru." });
  }
});

router.patch("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Neplatné ID." });
    }

    const updatedFields = req.body;

    const doc = await UserRecipe.findOne({ _id: id, owner: req.user._id });
    if (!doc) {
      return res.status(404).json({ error: "Recept nenalezen." });
    }

    const hadPublicBefore = !!doc.publicRecipeId;

    if ("title" in updatedFields) {
      if (
        typeof updatedFields.title !== "string" ||
        updatedFields.title.trim() === ""
      ) {
        return res
          .status(400)
          .json({ error: "Nový název receptu je neplatný." });
      }

      doc.title = updatedFields.title.trim();
    }

    if ("difficulty" in updatedFields) {
      const normalizedDifficulty = normalizeDifficulty(
        updatedFields.difficulty,
      );

      if (!normalizedDifficulty) {
        return res.status(400).json({
          error: "difficulty musí být Beginner, Intermediate nebo Hard.",
        });
      }

      doc.difficulty = normalizedDifficulty;
    }

    if ("time" in updatedFields) {
      const normalizedTime = normalizeTime(updatedFields.time);

      if (!normalizedTime) {
        return res.status(400).json({
          error: "time musí být ve formátu HH:MM.",
        });
      }

      doc.time = normalizedTime;
    }

    if ("rating" in updatedFields) {
      if (
        typeof updatedFields.rating !== "number" ||
        updatedFields.rating < 0
      ) {
        return res.status(400).json({ error: "rating musí být číslo >= 0." });
      }

      doc.rating = updatedFields.rating;
    }

    if ("ingredients" in updatedFields) {
      if (!Array.isArray(updatedFields.ingredients)) {
        return res
          .status(400)
          .json({ error: "ingredients musí být pole stringů." });
      }

      const normalizedIngredients = updatedFields.ingredients
        .map((i) => String(i).trim())
        .filter(Boolean);

      doc.ingredients = normalizedIngredients;
      doc.structuredIngredients = parseIngredientList(normalizedIngredients);
    }

    if ("steps" in updatedFields) {
      if (!validateSteps(updatedFields.steps)) {
        return res.status(400).json({ error: "steps má neplatný formát." });
      }

      doc.steps = updatedFields.steps;
    }

    if ("servings" in updatedFields) {
      const parsedServings = Number(updatedFields.servings);

      if (!Number.isInteger(parsedServings) || parsedServings < 1) {
        return res
          .status(400)
          .json({ error: "servings musí být celé číslo >= 1." });
      }

      doc.servings = parsedServings;
    }

    if ("isPublic" in updatedFields) {
      doc.isPublic = !!updatedFields.isPublic;
    }

    await doc.save();

    if (doc.isPublic && !hadPublicBefore && !doc.publicRecipeId) {
      await createPublicRecipeFromUserRecipe(doc);
    } else if (!doc.isPublic && hadPublicBefore && doc.publicRecipeId) {
      await removePublicRecipeLink(doc);
    } else if (doc.isPublic && doc.publicRecipeId) {
      await syncPublicRecipeFromUserRecipe(doc);
    }

    const freshDoc = await UserRecipe.findById(doc._id);

    res.json(freshDoc);
  } catch (err) {
    console.error("PATCH /api/my-recipes/:id error:", err);
    res.status(500).json({ error: "Interní chyba serveru." });
  }
});

router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ error: "Neplatné ID." });

    const doc = await UserRecipe.findOne({
      _id: id,
      owner: req.user._id,
    });

    if (!doc) {
      return res
        .status(404)
        .json({ error: "Recept nenalezen nebo nemáš oprávnění." });
    }

    await deleteRecipeAssets(doc);

    if (doc.publicRecipeId) {
      await CommunityRecipe.findByIdAndDelete(doc.publicRecipeId).catch(
        () => {},
      );
    }

    await doc.deleteOne();

    res.json({ message: "Recept smazán." });
  } catch (err) {
    console.error("DELETE /api/my-recipes/:id error:", err);
    res.status(500).json({ error: "Interní chyba serveru." });
  }
});

module.exports = router;
