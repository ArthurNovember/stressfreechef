// models/CommunityRecipe.js
const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  {
    url: { type: String },
    publicId: { type: String },
    width: { type: Number },
    height: { type: Number },
    format: { type: String },
  },
  { _id: false }
);

const stepSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["image", "video", "text"], required: true },
    src: {
      type: String,
      required: function () {
        return this.type === "image" || this.type === "video";
      },
    },
    description: { type: String, required: true },
  },
  { _id: false }
);

const communityRecipeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    rating: { type: Number, default: 0 },
    difficulty: { type: String, required: true },
    time: { type: String, required: true },
    imgSrc: { type: String },
    image: imageSchema, // NOVÉ pole
    ingredients: [{ type: String }],
    steps: [stepSchema],

    // volitelné: ukázat autora u veřejných receptů
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CommunityRecipe", communityRecipeSchema);
