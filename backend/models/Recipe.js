const mongoose = require('mongoose');
// Definice schématu
const recipeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  difficulty: String,      // ← přidáno
  time: Number             // ← přidáno (v minutách)
});

recipeSchema.index({ title: 1 }); // 1 = vzestupné řazení
recipeSchema.index({ time: 1 });       // ! přidává index pro rychlé filtrování dle času
recipeSchema.index({ difficulty: 1 }); // ! přidává index pro rychlé filtrování dle obtížnosti

// Vytvoření modelu
const Recipe = mongoose.model('Recipe', recipeSchema);
module.exports = Recipe;