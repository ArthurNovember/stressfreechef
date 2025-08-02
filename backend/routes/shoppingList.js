const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authenticateToken = require("../middleware/authenticateToken");

// GET user's shopping list
router.get("/", authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json(user.shoppingList);
});

// POST add item to shopping list
router.post("/", authenticateToken, async (req, res) => {
  const { text, shop } = req.body;
  const user = await User.findById(req.user.id);
  user.shoppingList.push({ text, shop, checked: false });
  await user.save();
  res.json(user.shoppingList);
});

// PATCH toggle check or update shop
router.patch("/:index", authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id);
  const { index } = req.params;
  const item = user.shoppingList[index];
  if (!item) return res.status(404).json({ error: "Item not found" });

  if (req.body.hasOwnProperty("checked")) item.checked = req.body.checked;
  if (req.body.shop) item.shop = req.body.shop;

  await user.save();
  res.json(user.shoppingList);
});

// DELETE item from shopping list
router.delete("/:index", authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id);
  const { index } = req.params;
  user.shoppingList.splice(index, 1);
  await user.save();
  res.json(user.shoppingList);
});

module.exports = router;
