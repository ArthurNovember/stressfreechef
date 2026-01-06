const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const authenticateToken = require("../middleware/authenticateToken");
const UserRecipe = require("../models/UserRecipe");
const CommunityRecipe = require("../models/CommunityRecipe");

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
      isPublic,
    } = req.body;

    if (!title || !difficulty || !time) {
      return res
        .status(400)
        .json({ error: "title, difficulty a time jsou povinné." });
    }
    if (steps && !validateSteps(steps)) {
      return res.status(400).json({ error: "steps má neplatný formát." });
    }

    const userRec = await UserRecipe.create({
      title: String(title).trim(),
      rating: typeof rating === "number" ? rating : 0,
      difficulty: String(difficulty).trim(),
      time: String(time).trim(),
      imgSrc: imgSrc ? String(imgSrc) : undefined,
      image: req.body?.image,
      ingredients: Array.isArray(ingredients)
        ? ingredients.map((i) => String(i).trim()).filter(Boolean)
        : [],
      steps: steps || [],
      owner: req.user._id,
      isPublic: !!isPublic,
    });

    if (isPublic) {
      const publicDoc = await CommunityRecipe.create({
        title: userRec.title,
        rating: userRec.rating,
        difficulty: userRec.difficulty,
        time: userRec.time,
        imgSrc: userRec.imgSrc,
        image: userRec.image,
        ingredients: userRec.ingredients,
        steps: userRec.steps,
        owner: req.user._id,
      });
      userRec.publicRecipeId = publicDoc._id;
      await userRec.save();
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
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ error: "Neplatné ID." });

    const allowed = [
      "title",
      "rating",
      "difficulty",
      "time",
      "imgSrc",
      "ingredients",
      "steps",
      "isPublic",
    ];
    const update = {};
    for (const k of allowed) if (k in req.body) update[k] = req.body[k];

    if ("steps" in update && !validateSteps(update.steps)) {
      return res.status(400).json({ error: "steps má neplatný formát." });
    }
    if ("ingredients" in update && !Array.isArray(update.ingredients)) {
      return res
        .status(400)
        .json({ error: "ingredients musí být pole stringů." });
    }

    const doc = await UserRecipe.findOne({ _id: id, owner: req.user._id });
    if (!doc)
      return res
        .status(404)
        .json({ error: "Recept nenalezen nebo nemáš oprávnění." });

    for (const k of allowed) {
      if (k in update) doc[k] = update[k];
    }

    const wantsPublic = !!doc.isPublic;

    if (wantsPublic && !doc.publicRecipeId) {
      const pub = await CommunityRecipe.create({
        title: doc.title,
        rating: doc.rating,
        difficulty: doc.difficulty,
        time: doc.time,
        imgSrc: doc.imgSrc,
        image: doc.image,
        ingredients: doc.ingredients,
        steps: doc.steps,
        owner: req.user._id,
      });
      doc.publicRecipeId = pub._id;
    } else if (!wantsPublic && doc.publicRecipeId) {
      await CommunityRecipe.findByIdAndDelete(doc.publicRecipeId).catch(
        () => {}
      );
      doc.publicRecipeId = null;
    } else if (wantsPublic && doc.publicRecipeId) {
      await CommunityRecipe.findByIdAndUpdate(
        doc.publicRecipeId,
        {
          title: doc.title,
          rating: doc.rating,
          difficulty: doc.difficulty,
          time: doc.time,
          imgSrc: doc.imgSrc,
          image: doc.image,
          ingredients: doc.ingredients,
          steps: doc.steps,
        },
        { new: false }
      );
    }

    await doc.save();
    return res.json(doc);
  } catch (err) {
    console.error("PATCH /api/my-recipes/:id error:", err);
    return res.status(500).json({ error: "Interní chyba serveru." });
  }
});

router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ error: "Neplatné ID." });

    const doc = await UserRecipe.findOneAndDelete({
      _id: id,
      owner: req.user._id,
    });
    if (!doc)
      return res
        .status(404)
        .json({ error: "Recept nenalezen nebo nemáš oprávnění." });

    if (doc.publicRecipeId) {
      await CommunityRecipe.findByIdAndDelete(doc.publicRecipeId).catch(
        () => {}
      );
    }

    res.json({ message: "Recept smazán." });
  } catch (err) {
    console.error("DELETE /api/my-recipes/:id error:", err);
    res.status(500).json({ error: "Interní chyba serveru." });
  }
});

module.exports = router;
