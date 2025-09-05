// routes/favorites.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authenticateToken = require("../middleware/authenticateToken");

// GET user's favorites
router.get("/", authenticateToken, async (req, res) => {
  const user = await User.findById(req.user._id).populate("favoriteItems.shop");
  res.json(user.favoriteItems);
});

// POST add favorite
router.post("/", authenticateToken, async (req, res) => {
  const { text, shop } = req.body; // shop = [shopIds]
  const user = await User.findById(req.user._id);

  // volitelná deduplikace podle textu (klidně vyhoď, pokud nechceš)
  const already = user.favoriteItems.some(
    (i) => i.text.trim().toLowerCase() === (text || "").trim().toLowerCase()
  );
  if (!already) {
    user.favoriteItems.push({ text, shop: shop || [] });
    await user.save();
    const t = (req.body.text || "").trim();
    if (t) {
      await User.updateOne(
        { _id: req.user._id },
        { $addToSet: { itemSuggestions: t } }
      );
    }
  }

  await user.populate("favoriteItems.shop");
  res.json(user.favoriteItems);
});

// PATCH update favorite (aktuálně text / shop)
router.patch("/:itemId", authenticateToken, async (req, res) => {
  const { itemId } = req.params;
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const item = user.favoriteItems.id(itemId);
  if (!item) return res.status(404).json({ error: "Item not found" });

  if (req.body.hasOwnProperty("text")) item.text = req.body.text;
  if (req.body.shop) item.shop = req.body.shop;

  await user.save();
  await user.populate("favoriteItems.shop");
  res.json(user.favoriteItems);
});

// DELETE favorite
router.delete("/:itemId", authenticateToken, async (req, res) => {
  const { itemId } = req.params;
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.favoriteItems = user.favoriteItems.filter(
    (i) => String(i._id) !== String(itemId)
  );
  await user.save();
  await user.populate("favoriteItems.shop");
  res.json(user.favoriteItems);
});

module.exports = router;
