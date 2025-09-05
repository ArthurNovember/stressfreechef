// routes/itemSuggestions.js
const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authenticateToken");
const User = require("../models/User");

// GET /api/item-suggestions
router.get("/", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "itemSuggestions shoppingList favoriteItems"
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    // 1) Primárně perzistentní seznam
    let suggestions = Array.isArray(user.itemSuggestions)
      ? [...user.itemSuggestions]
      : [];

    // 2) Fallback migrace: když je prázdno, naplň jednorázově z aktuálních dat
    if (suggestions.length === 0) {
      const texts = [
        ...(user.shoppingList || []).map((i) => (i.text || "").trim()),
        ...(user.favoriteItems || []).map((i) => (i.text || "").trim()),
      ].filter(Boolean);

      const seen = new Set();
      for (const t of texts) {
        const k = t.toLowerCase();
        if (!seen.has(k)) {
          seen.add(k);
          suggestions.push(t);
        }
      }

      if (suggestions.length > 0) {
        await User.updateOne(
          { _id: user._id },
          { $addToSet: { itemSuggestions: { $each: suggestions } } }
        );
      }
    }

    // 3) Seřazení
    suggestions.sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );

    res.json(suggestions);
  } catch (err) {
    console.error("item-suggestions error:", err);
    res.status(500).json({ error: "Failed to fetch suggestions" });
  }
});

module.exports = router;
