const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true },
    width: { type: Number },
    height: { type: Number },
    format: { type: String, trim: true },
  },
  { _id: false },
);

const stepSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["image", "video", "text"], required: true },
    src: {
      type: String,
      trim: true,
      required: function () {
        return this.type === "image" || this.type === "video";
      },
    },
    description: { type: String, required: true, trim: true },

    timerSeconds: {
      type: Number,
      min: 0,
    },

    mediaPublicId: { type: String, trim: true },
    mediaWidth: Number,
    mediaHeight: Number,
    mediaFormat: { type: String, trim: true },
  },
  { _id: false },
);

const structuredIngredientSchema = new mongoose.Schema(
  {
    original: { type: String, required: true, trim: true },
    quantity: { type: Number, default: null },
    unit: { type: String, default: null, trim: true },
    name: { type: String, required: true, trim: true },
    scalable: { type: Boolean, default: false },
  },
  { _id: false },
);

const communityRecipeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },

    rating: { type: Number, default: 0, min: 0 },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    ratings: {
      type: [
        {
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          value: { type: Number, min: 1, max: 5, required: true },
          _id: false,
        },
      ],
      default: [],
    },

    sourceRecipeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      default: null,
    },
    difficulty: {
      type: String,
      required: true,
      trim: true,
      enum: ["Beginner", "Intermediate", "Hard"],
    },
    time: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{2}:\d{2}$/,
    },
    imgSrc: { type: String, trim: true },
    image: imageSchema,
    ingredients: [{ type: String, trim: true }],
    steps: [stepSchema],
    servings: { type: Number, min: 1, default: 1 },

    structuredIngredients: [structuredIngredientSchema],

    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
communityRecipeSchema.index({ owner: 1 });
communityRecipeSchema.index({ sourceRecipeId: 1 });
module.exports = mongoose.model("CommunityRecipe", communityRecipeSchema);
