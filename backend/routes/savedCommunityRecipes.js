const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authenticateToken");
const User = require("../models/User");
const CommunityRecipe = require("../models/CommunityRecipe");

// GET /api/saved-community-recipes?page=&limit=&sort=
router.get("/", authenticateToken, async (req, res) => {
  const userId = req.user._id;

  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 50);
    const skip = (page - 1) * limit;

    const sort = String(req.query.sort || "newest").toLowerCase();
    let sortSpec = { createdAt: -1 };
    if (sort === "favorite" || sort === "rating") {
      sortSpec = { ratingAvg: -1, ratingCount: -1, createdAt: -1 };
    }

    // 1) vezmi jen IDs uložených receptů
    const user = await User.findById(userId)
      .select("savedCommunityRecipes")
      .lean();
    const ids = user?.savedCommunityRecipes || [];

    const total = ids.length;
    const pages = Math.max(1, Math.ceil(total / limit));

    if (ids.length === 0) {
      return res.json({ items: [], page, limit, total, pages });
    }

    // 2) dotáhni CommunityRecipe dokumenty, globálně seřaď a stránkuj
    const items = await CommunityRecipe.find({ _id: { $in: ids } })
      .sort(sortSpec)
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({ items, page, limit, total, pages });
  } catch (err) {
    console.error("GET saved recipes failed:", err);
    res.status(500).json({ error: "Failed to load saved recipes." });
  }
});

// POST /api/saved-community-recipes  { recipeId }
router.post("/", authenticateToken, async (req, res) => {
  const userId = req.user._id;
  const { recipeId } = req.body;

  if (!recipeId) {
    return res.status(400).json({ error: "recipeId is required." });
  }

  try {
    const recipe = await CommunityRecipe.findById(recipeId);
    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const exists = user.savedCommunityRecipes.some(
      (id) => String(id) === String(recipeId)
    );
    if (!exists) {
      user.savedCommunityRecipes.push(recipeId);
      await user.save();
    }

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("POST saved recipe failed:", err);
    res.status(500).json({ error: "Failed to save recipe." });
  }
});

// DELETE /api/saved-community-recipes/:id
router.delete("/:id", authenticateToken, async (req, res) => {
  const userId = req.user._id;
  const recipeId = req.params.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    user.savedCommunityRecipes = user.savedCommunityRecipes.filter(
      (id) => String(id) !== String(recipeId)
    );
    await user.save();

    res.status(204).send();
  } catch (err) {
    console.error("DELETE saved recipe failed:", err);
    res.status(500).json({ error: "Failed to remove saved recipe." });
  }
});

module.exports = router;
