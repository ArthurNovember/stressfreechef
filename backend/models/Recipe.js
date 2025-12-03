const mongoose = require("mongoose");
// Definice schématu
const stepSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["image", "video", "text"], // ✅ Nově podporujeme i textový krok
    required: true,
  },
  src: {
    type: String,
    required: function () {
      // src je povinný JEN pokud je typ 'image' nebo 'video'
      return this.type === "image" || this.type === "video";
    },
  },
  description: {
    type: String,
    required: true,
  },
  descriptionCs: {
    type: String,
  },
  timerSeconds: {
    type: Number,
    min: 0,
  },
});

const recipeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true }, // ✅ Opraveno z 'name'
    titleCs: { type: String },
    rating: { type: Number, default: 0 },
    difficulty: { type: String, required: true },
    time: { type: String, required: true },
    imgSrc: { type: String },
    ingredients: [{ type: String }], // ✅ Opraveno z 'ingredience'
    ingredientsCs: [{ type: String }],
    steps: [stepSchema],
    id: { type: Number }, // volitelně
  },
  { timestamps: true }
);

// Vytvoření modelu
const Recipe = mongoose.model("Recipe", recipeSchema);
module.exports = Recipe;
