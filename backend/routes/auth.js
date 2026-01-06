const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const authenticateToken = require("../middleware/authenticateToken");

router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: "Uživatelské jméno, email a heslo jsou povinné." });
  }

  try {
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

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email a heslo jsou povinné." });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Neplatné přihlašovací údaje." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Neplatné přihlašovací údaje." });
    }

    const token = jwt.sign(
      {
        _id: user._id,
        email: user.email,
        username: user.username,
      },
      process.env.JWT_SECRET
    );

    res.json({ token });
  } catch (err) {
    console.error("Chyba při přihlašování:", err);
    res.status(500).json({ error: "Interní chyba serveru." });
  }
});

router.get("/profile", authenticateToken, (req, res) => {
  res.json({
    message: "Přístup povolen – přihlášený uživatel",
    user: req.user,
  });
});

router.delete("/account", authenticateToken, async (req, res) => {
  const userId = req.user._id;

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

    if (CommunityRecipe) {
      await CommunityRecipe.deleteMany({ owner: userId });
    }

    if (CommunityRating) {
      await CommunityRating.deleteMany({ user: userId });
    }

    await User.findByIdAndDelete(userId);

    return res.status(204).send();
  } catch (err) {
    console.error("Account deletion failed:", err);
    return res.status(500).json({ error: "Account deletion failed." });
  }
});

module.exports = router;
