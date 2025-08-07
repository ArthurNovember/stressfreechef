const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authenticateToken = require("../middleware/authenticateToken");
const Shop = require("../models/Shop");

// GET user's shopping list
router.get("/", authenticateToken, async (req, res) => {
  const user = await User.findById(req.user._id).populate("shoppingList.shop");
  res.json(user.shoppingList);
});

// POST add item to shopping list
router.post("/", authenticateToken, async (req, res) => {
  const { text, shop } = req.body;
  const user = await User.findById(req.user._id);
  user.shoppingList.push({ text, shop, checked: false });
  await user.save();
  res.json(user.shoppingList);
});

// PATCH toggle check or update shop
router.patch("/:index", authenticateToken, async (req, res) => {
  const user = await User.findById(req.user._id);
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
  const user = await User.findById(req.user._id);
  const { index } = req.params;
  user.shoppingList.splice(index, 1);
  await user.save();
  res.json(user.shoppingList);
});

router.get("/shop-options", authenticateToken, async (req, res) => {
  const userId = req.user._id;

  try {
    const shops = await Shop.find({ owner: userId });
    res.json(shops);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/shop-options", authenticateToken, async (req, res) => {
  const { name } = req.body;
  const userId = req.user._id;

  try {
    const newShop = await Shop.create({ name, owner: userId });
    res.status(201).json(newShop);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
