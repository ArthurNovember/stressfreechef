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
  },
  { _id: false }
);

const communityRecipeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },

    rating: { type: Number, default: 0 },
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
    difficulty: { type: String, required: true },
    time: { type: String, required: true },
    imgSrc: { type: String },
    image: imageSchema,
    ingredients: [{ type: String }],
    steps: [stepSchema],

    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CommunityRecipe", communityRecipeSchema);
