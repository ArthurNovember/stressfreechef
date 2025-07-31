const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const MyRecipe = require('../models/MyRecipe');
// POST /api/my-recipes
router.post('/my-recipes', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      rating,
      difficulty,
      time,
      imgSrc,
      ingredients,
      steps
    } = req.body;
    // vytvoření receptu s přiřazením ownera
    const newRecipe = new MyRecipe({
      title,
      rating,
      difficulty,
      time,
      imgSrc,
      ingredients,
      steps,
      owner: req.user.id // přihlášený uživatel
    });
    await newRecipe.save();
    res.status(201).json({ message: 'Recept uložen!', recipe: newRecipe });
  } catch (err) {
    console.error('Chyba při ukládání receptu:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});
module.exports = router;
