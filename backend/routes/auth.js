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

module.exports = router;
