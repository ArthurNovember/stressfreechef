const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authenticateToken");
const User = require("../models/User");
const CommunityRecipe = require("../models/CommunityRecipe");

// GET /api/saved-community-recipes
router.get("/", authenticateToken, async (req, res) => {
  const userId = req.user._id;
  try {
    const user = await User.findById(userId)
      .populate("savedCommunityRecipes")
      .lean();

    res.json(user?.savedCommunityRecipes || []);
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
