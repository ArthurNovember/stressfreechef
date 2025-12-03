// models/UserRecipe.js
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
    timerSeconds: {
      type: Number,
      min: 0,
    },
    // ↓↓↓ NOVÉ – pro čisté mazání a užitečná metadata
    mediaPublicId: { type: String },
    mediaWidth: Number,
    mediaHeight: Number,
    mediaFormat: String,
  },

  { _id: false }
);

const userRecipeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    rating: { type: Number, default: 0 },
    difficulty: { type: String, required: true },
    time: { type: String, required: true },
    imgSrc: { type: String },
    image: imageSchema, // NOVÉ pole
    ingredients: [{ type: String }],
    steps: [stepSchema],

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 🔽 nově
    isPublic: { type: Boolean, default: false },
    publicRecipeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommunityRecipe",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserRecipe", userRecipeSchema);
