// routes/communityRecipes.js
const express = require("express");
const router = express.Router();
const CommunityRecipe = require("../models/CommunityRecipe");
const Recipe = require("../models/Recipe");

// GET /api/community-recipes?page=&limit=&q=
// GET /api/community-recipes?page=&limit=&q=&sort=&includeDerived=
router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 50);
    const skip = (page - 1) * limit;

    const q = (req.query.q || "").trim();
    const sort = String(req.query.sort || "newest").toLowerCase();

    const includeDerived = ["1", "true", "yes"].includes(
      String(req.query.includeDerived || "").toLowerCase()
    );

    const baseFilter = q ? { title: { $regex: q, $options: "i" } } : {};
    const filter = includeDerived
      ? baseFilter
      : { ...baseFilter, sourceRecipeId: null };

    const total = await CommunityRecipe.countDocuments(filter);
    const pages = Math.ceil(total / limit);

    // ✅ EASIEST = Beginner -> Intermediate -> Hard (správně přes aggregation)
    if (sort === "easiest") {
      const items = await CommunityRecipe.aggregate([
        { $match: filter },
        {
          $addFields: {
            difficultyRank: {
              $switch: {
                branches: [
                  { case: { $eq: ["$difficulty", "Beginner"] }, then: 1 },
                  { case: { $eq: ["$difficulty", "Intermediate"] }, then: 2 },
                  { case: { $eq: ["$difficulty", "Hard"] }, then: 3 },
                ],
                default: 99,
              },
            },
          },
        },
        { $sort: { difficultyRank: 1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        { $project: { difficultyRank: 0 } },
      ]);

      return res.json({ items, page, limit, total, pages });
    }

    // ✅ ostatní sorty = find().sort()
    let sortSpec = { createdAt: -1 }; // newest
    if (sort === "favorite" || sort === "top" || sort === "rating") {
      sortSpec = { ratingAvg: -1, ratingCount: -1, createdAt: -1 };
    } else if (sort === "newest") {
      sortSpec = { createdAt: -1 };
    }

    const items = await CommunityRecipe.find(filter)
      .sort(sortSpec)
      .skip(skip)
      .limit(limit);

    return res.json({ items, page, limit, total, pages });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Interní chyba serveru." });
  }
});

// GET detail
router.get("/:id", async (req, res) => {
  try {
    const doc = await CommunityRecipe.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Recept nenalezen." });
    res.json(doc);
  } catch {
    res.status(400).json({ error: "Neplatné ID." });
  }
});

// POST /api/community-recipes/ensure-from-recipe/:recipeId
router.post("/ensure-from-recipe/:recipeId", async (req, res) => {
  try {
    const { recipeId } = req.params;

    // 1) existuje community kopie?
    let doc = await CommunityRecipe.findOne({ sourceRecipeId: recipeId });
    if (doc) {
      return res.json({
        ok: true,
        _id: doc._id,
        ratingAvg: doc.ratingAvg || 0,
        ratingCount: doc.ratingCount || 0,
      });
    }

    // 2) načti ofiko Recipe
    const base = await Recipe.findById(recipeId);
    if (!base) return res.status(404).json({ error: "Base recipe not found." });

    // 3) založ community „dvojče“
    doc = await CommunityRecipe.create({
      title: base.title,
      rating: base.rating || 0,
      difficulty: base.difficulty,
      time: base.time,
      imgSrc: base.imgSrc,
      image: base.image,
      ingredients: base.ingredients || [],
      steps: base.steps || [],
      sourceRecipeId: base._id,
    });

    return res
      .status(201)
      .json({ ok: true, _id: doc._id, ratingAvg: 0, ratingCount: 0 });
  } catch (e) {
    console.error("ensure-from-recipe error:", e);
    res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;
