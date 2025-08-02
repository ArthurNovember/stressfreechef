const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true, // volitelné: zabrání duplicitám
    trim: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },

  shoppingList: [
    {
      text: String,
      shop: [String],
      checked: { type: Boolean, default: false },
    },
  ],
});

userSchema.pre("save", async function (next) {
  const user = this;
  // pokud se heslo nemění, přeskoč hashování
  if (!user.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10); // síla hashe
    const hashedPassword = await bcrypt.hash(user.password, salt);
    user.password = hashedPassword;
    next();
  } catch (err) {
    next(err);
  }
});

const User = mongoose.model("User", userSchema);
module.exports = User;
