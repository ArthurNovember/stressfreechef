const express = require("express");
require("dotenv").config(); // Načti .env soubor
const mongoose = require("mongoose"); // Import Mongoose
const cors = require("cors");

const Recipe = require("./models/Recipe");

// Připojení k MongoDB
mongoose
  .connect(process.env.MONGO_URL)
  .then(async () => {
    console.log("✅ Připojeno k MongoDB");

    await Recipe.init();
  })
  .catch((err) => console.error("❌ Nepodařilo se připojit k MongoDB:", err));

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(cors());
// app.use(cors({
//   origin: 'https://stressfreecheff-backend.onrender.com/' //  Až bude napojen frontend
// }));

// ✅ Připoj router
const recipesRouter = require("./routes/recipes");
app.use("/api/recipes", recipesRouter);

const authRoutes = require("./routes/auth");
app.use("/api", authRoutes);

app.get("/", (req, res) => {
  res.send("Backend běží!");
});

app.get("/api/ping", (req, res) => {
  res.status(200).send("OK");
});

app.use((err, req, res, next) => {
  console.error("❌ Chyba v aplikaci:", err.stack);
  res.status(500).json({ error: "Došlo k chybě na serveru." });
});

const shoppingListRouter = require("./routes/shoppingList");
app.use("/api/shopping-list", shoppingListRouter);

const favoritesRouter = require("./routes/favorites");
app.use("/api/favorites", favoritesRouter);

const itemSuggestionsRouter = require("./routes/itemSuggestions");
app.use("/api/item-suggestions", itemSuggestionsRouter);

const myRecipesRouter = require("./routes/myRecipes");
app.use("/api/my-recipes", myRecipesRouter);

const communityRecipesRouter = require("./routes/communityRecipes");
app.use("/api/community-recipes", communityRecipesRouter);

const communityRatingsRouter = require("./routes/communityRatings");
app.use("/api/community-recipes", communityRatingsRouter);

const uploadRoutes = require("./routes/uploadRoutes");
app.use("/api/uploads", uploadRoutes);

const savedCommunityRecipesRouter = require("./routes/savedCommunityRecipes");
app.use("/api/saved-community-recipes", savedCommunityRecipesRouter);

app.get("/api/ping", (req, res) => {
  res.type("text").status(200).send("OK");
});

app.listen(PORT, () => {
  console.log(`✅ Server běží na portu ${PORT}`);
});
