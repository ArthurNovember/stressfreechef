const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const authenticateToken = require("../middleware/authenticateToken");
const CommunityRecipe = require("../models/CommunityRecipe");

router.post("/:id/rate", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const value = Number(req.body?.value);

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid recipe id." });
    }
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return res.status(400).json({ error: "Rating must be 1–5 (integer)." });
    }

    const doc = await CommunityRecipe.findById(id);
    if (!doc) return res.status(404).json({ error: "Recipe not found." });

    const uid = String(req.user._id);
    const idx = doc.ratings.findIndex((r) => String(r.user) === uid);
    if (idx >= 0) {
      doc.ratings[idx].value = value;
    } else {
      doc.ratings.push({ user: req.user._id, value });
    }

    const count = doc.ratings.length;
    const sum = doc.ratings.reduce((acc, r) => acc + (r.value || 0), 0);
    doc.ratingCount = count;
    doc.ratingAvg = count ? sum / count : 0;

    doc.rating = Math.round(doc.ratingAvg);

    await doc.save();

    res.json({
      ok: true,
      ratingAvg: doc.ratingAvg,
      ratingCount: doc.ratingCount,
      ratingRounded: doc.rating,
    });
  } catch (err) {
    console.error("POST /api/community-recipes/:id/rate", err);
    res.status(500).json({ error: "Server error." });
  }
});

router.get("/:id/my-rating", authenticateToken, async (req, res) => {
  try {
    const doc = await CommunityRecipe.findById(req.params.id).select("ratings");
    if (!doc) return res.status(404).json({ error: "Recipe not found." });
    const r = doc.ratings.find((x) => String(x.user) === String(req.user._id));
    res.json({ value: r?.value ?? null });
  } catch (e) {
    res.status(400).json({ error: "Invalid id." });
  }
});

module.exports = router;
