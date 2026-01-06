const mongoose = require("mongoose");

const stepSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["image", "video", "text"],
    required: true,
  },
  src: {
    type: String,
    required: function () {
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
    title: { type: String, required: true },
    titleCs: { type: String },
    rating: { type: Number, default: 0 },
    difficulty: { type: String, required: true },
    time: { type: String, required: true },
    imgSrc: { type: String },
    ingredients: [{ type: String }],
    ingredientsCs: [{ type: String }],
    steps: [stepSchema],
    id: { type: Number },
  },
  { timestamps: true }
);

const Recipe = mongoose.model("Recipe", recipeSchema);
module.exports = Recipe;
