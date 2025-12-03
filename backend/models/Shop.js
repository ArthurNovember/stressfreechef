const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
});
shopSchema.index({ owner: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Shop", shopSchema);
