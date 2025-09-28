const express = require("express");
const router = express.Router();
const User = require("../models/User"); // import User model
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const authenticateToken = require("../middleware/authenticateToken");

// ✅ POST /api/register
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  // kontrola vstupu
  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: "Uživatelské jméno, email a heslo jsou povinné." });
  }

  try {
    // kontrola, jestli už email nebo username existuje
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res
        .status(409)
        .json({ error: "Uživatel s tímto e-mailem už existuje." });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res
        .status(409)
        .json({ error: "Toto uživatelské jméno je již zabrané." });
    }

    // vytvoření nového uživatele
    const newUser = new User({
      username,
      email,
      password,
    });

    await newUser.save();
    res.status(201).json({ message: "Uživatel úspěšně zaregistrován." });
  } catch (err) {
    console.error("Chyba při registraci:", err);
    res.status(500).json({ error: "Interní chyba serveru." });
  }
});

//  ✅POST /api/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  // kontrola vstupu
  if (!email || !password) {
    return res.status(400).json({ error: "Email a heslo jsou povinné." });
  }
  try {
    // najdi uživatele podle e-mailu
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Neplatné přihlašovací údaje." });
    }
    // ověř heslo
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Neplatné přihlašovací údaje." });
    }
    // vygeneruj token
    const token = jwt.sign(
      {
        _id: user._id,
        email: user.email,
        username: user.username, // ✅ přidáno
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({ token });
  } catch (err) {
    console.error("Chyba při přihlašování:", err);
    res.status(500).json({ error: "Interní chyba serveru." });
  }
});

// ✅ Chráněná route
router.get("/profile", authenticateToken, (req, res) => {
  res.json({
    message: "Přístup povolen – přihlášený uživatel",
    user: req.user, // obsah tokenu – např. { id: ..., email: ... }
  });
});

// DELETE /api/account — smaže účet + všechna navázaná data
router.delete("/account", authenticateToken, async (req, res) => {
  const userId = req.user._id;

  // Načtení volitelných modelů (uprav cesty/názvy podle projektu)
  let UserRecipe, CommunityRecipe, CommunityRating;
  try {
    UserRecipe = require("../models/UserRecipe");
  } catch {}
  try {
    CommunityRecipe = require("../models/CommunityRecipe");
  } catch {}
  try {
    CommunityRating = require("../models/CommunityRating");
  } catch {}

  const cloudinary = require("cloudinary").v2;

  try {
    // 1) Smazat uploady + soukromé recepty
    if (UserRecipe) {
      const myRecipes = await UserRecipe.find({ owner: userId }).lean();

      if (cloudinary) {
        for (const r of myRecipes) {
          const coverId = r?.image?.publicId;
          if (coverId) {
            try {
              await cloudinary.uploader.destroy(coverId);
            } catch (e) {
              console.warn("CLD cover destroy fail:", e?.message || e);
            }
          }
          for (const s of r?.steps || []) {
            if (s?.mediaPublicId) {
              try {
                await cloudinary.uploader.destroy(s.mediaPublicId);
              } catch (e) {
                console.warn("CLD step destroy fail:", e?.message || e);
              }
            }
          }
        }
      }

      await UserRecipe.deleteMany({ owner: userId });
    }

    // 2) Community recepty – výchozí: úplně smazat
    if (CommunityRecipe) {
      await CommunityRecipe.deleteMany({ owner: userId });
    }

    // 3) Hodnocení
    if (CommunityRating) {
      await CommunityRating.deleteMany({ user: userId });
    }

    // 4) Smazat samotného uživatele (embedded shoppingList, favoriteItems, itemSuggestions zmizí s ním)
    await User.findByIdAndDelete(userId);

    return res.status(204).send();
  } catch (err) {
    console.error("Account deletion failed:", err);
    return res.status(500).json({ error: "Account deletion failed." });
  }
});

module.exports = router;
