// routes/communityRecipes.js
const express = require("express");
const router = express.Router();
const CommunityRecipe = require("../models/CommunityRecipe");

// GET /api/community-recipes?page=&limit=&q=
router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 50);
    const skip = (page - 1) * limit;
    const q = (req.query.q || "").trim();

    const filter = q ? { title: { $regex: q, $options: "i" } } : {};
    const [items, total] = await Promise.all([
      CommunityRecipe.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      CommunityRecipe.countDocuments(filter),
    ]);

    res.json({ items, page, limit, total, pages: Math.ceil(total / limit) });
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

module.exports = router;
