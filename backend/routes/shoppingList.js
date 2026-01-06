const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authenticateToken = require("../middleware/authenticateToken");
const Shop = require("../models/Shop");

router.get("/", authenticateToken, async (req, res) => {
  const user = await User.findById(req.user._id).populate("shoppingList.shop");
  res.json(user.shoppingList);
});

router.post("/", authenticateToken, async (req, res) => {
  const { text, shop } = req.body;
  const user = await User.findById(req.user._id);
  user.shoppingList.push({ text, shop, checked: false });
  await user.save();

  const t = (req.body.text || "").trim();
  if (t) {
    await User.updateOne(
      { _id: req.user._id },
      { $addToSet: { itemSuggestions: t } }
    );
  }

  await user.populate("shoppingList.shop");
  res.json(user.shoppingList);
});

router.patch("/:itemId", authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const item = user.shoppingList.id(itemId);
    if (!item) return res.status(404).json({ error: "Item not found" });

    if (req.body.hasOwnProperty("checked")) item.checked = req.body.checked;
    if (req.body.shop) item.shop = req.body.shop;

    await user.save();
    await user.populate("shoppingList.shop");
    res.json(user.shoppingList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:itemId", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const { itemId } = req.params;
    user.shoppingList = user.shoppingList.filter(
      (i) => String(i._id) !== String(itemId)
    );

    await user.save();
    await user.populate("shoppingList.shop");
    res.json(user.shoppingList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

router.delete("/shop-options/:id", authenticateToken, async (req, res) => {
  const shopId = req.params.id;
  const userId = req.user._id;

  try {
    await Shop.deleteOne({ _id: shopId, owner: userId });

    await User.updateMany(
      { _id: userId },
      {
        $pull: {
          "shoppingList.$[].shop": shopId,
          "favoriteItems.$[].shop": shopId,
        },
      }
    );

    res.json({ message: "Shop deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
