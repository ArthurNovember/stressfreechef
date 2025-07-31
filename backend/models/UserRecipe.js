const mongoose = require('mongoose');

// Stejný krokový subschema jako v oficiálních receptech
const stepSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['image', 'video', 'text'],
    required: true
  },
  src: {
    type: String,
    required: function () {
      return this.type === 'image' || this.type === 'video';
    }
  },
  description: {
    type: String,
    required: true
  }
});

// Hlavní schéma vlastního receptu
const userRecipeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  rating: { type: Number, default: 0 },
  difficulty: { type: String, required: true },
  time: { type: String, required: true },
  imgSrc: { type: String },
  ingredients: [{ type: String }],
  steps: [stepSchema],

  // 🆕 Vlastník receptu
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

const UserRecipe = mongoose.model('UserRecipe', userRecipeSchema);
module.exports = UserRecipe;
