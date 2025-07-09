const mongoose = require('mongoose');
// Definice schématu
const recipeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  }
});
// Vytvoření modelu
const Recipe = mongoose.model('Recipe', recipeSchema);
module.exports = Recipe;