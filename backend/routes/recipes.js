const express = require("express");
const router = express.Router();
const Recipe = require("../models/Recipe");
const { parseIngredientList } = require("../utils/ingredientParser");
router.get("/", async (req, res) => {
  const filter = {};
  if (req.query.search) {
    filter.title = { $regex: req.query.search, $options: "i" };
  }

  if (req.query.difficulty) {
    filter.difficulty = req.query.difficulty;
  }

  if (req.query.maxTime) {
    filter.time = { $lte: Number(req.query.maxTime) };
  }

  const sortField = req.query.sortBy || "title";
  const sortOrder = req.query.order === "desc" ? -1 : 1;

  const limit = Number(req.query.limit) || 100;
  const page = Number(req.query.page) || 1;

  let query = Recipe.find(filter)
    .sort({ [sortField]: sortOrder })
    .skip((page - 1) * limit)
    .limit(limit);

  if (req.query.fields) {
    const fields = req.query.fields.split(",").join(" ");
    query = query.select(fields);
  }

  try {
    const results = await query;
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Chyba při získávání receptů" });
  }
});

router.post("/", async (req, res) => {
  const {
    title,
    titleCs,
    rating,
    difficulty,
    time,
    imgSrc,
    ingredients,
    ingredientsCs,
    steps,
    servings,
  } = req.body;

  try {
    const normalizedIngredients = Array.isArray(ingredients)
      ? ingredients.map((i) => String(i).trim()).filter(Boolean)
      : [];

    const normalizedIngredientsCs = Array.isArray(ingredientsCs)
      ? ingredientsCs.map((i) => String(i).trim()).filter(Boolean)
      : [];

    const parsedServings = Number(servings);
    const safeServings =
      Number.isInteger(parsedServings) && parsedServings > 0
        ? parsedServings
        : 1;

    const structuredIngredients = parseIngredientList(normalizedIngredients);
    const structuredIngredientsCs = parseIngredientList(
      normalizedIngredientsCs,
    );

    const newRecipe = new Recipe({
      title,
      titleCs,
      rating,
      difficulty,
      time,
      imgSrc,
      ingredients: normalizedIngredients,
      ingredientsCs: normalizedIngredientsCs,
      steps,
      servings: safeServings,
      structuredIngredients,
      structuredIngredientsCs,
    });

    await newRecipe.save();
    res.status(201).json(newRecipe);
  } catch (error) {
    console.error("Chyba při ukládání receptu:", error);
    res.status(500).json({ error: "Chyba při ukládání receptu" });
  }
});

router.delete("/:id", (req, res) => {
  Recipe.findByIdAndDelete(req.params.id)
    .then((deleted) => {
      if (!deleted) {
        return res.status(404).json({ error: "Recept nenalezen" });
      }
      res.status(204).send();
    })
    .catch((err) =>
      res.status(500).json({ error: "Chyba při mazání receptu" }),
    );
});

router.patch("/:id", (req, res) => {
  const updatedFields = req.body;

  if ("title" in updatedFields) {
    if (
      typeof updatedFields.title !== "string" ||
      updatedFields.title.trim() === ""
    ) {
      return res.status(400).json({ error: "Nový název receptu je neplatný." });
    }
    updatedFields.title = updatedFields.title.trim();
  }

  if ("ingredients" in updatedFields) {
    if (!Array.isArray(updatedFields.ingredients)) {
      return res
        .status(400)
        .json({ error: "ingredients musí být pole stringů." });
    }

    updatedFields.ingredients = updatedFields.ingredients
      .map((i) => String(i).trim())
      .filter(Boolean);

    updatedFields.structuredIngredients = parseIngredientList(
      updatedFields.ingredients,
    );
  }

  if ("ingredientsCs" in updatedFields) {
    if (!Array.isArray(updatedFields.ingredientsCs)) {
      return res
        .status(400)
        .json({ error: "ingredientsCs musí být pole stringů." });
    }

    updatedFields.ingredientsCs = updatedFields.ingredientsCs
      .map((i) => String(i).trim())
      .filter(Boolean);

    updatedFields.structuredIngredientsCs = parseIngredientList(
      updatedFields.ingredientsCs,
    );
  }

  if ("servings" in updatedFields) {
    const parsedServings = Number(updatedFields.servings);

    if (!Number.isInteger(parsedServings) || parsedServings < 1) {
      return res
        .status(400)
        .json({ error: "servings musí být celé číslo >= 1." });
    }

    updatedFields.servings = parsedServings;
  }

  Recipe.findByIdAndUpdate(req.params.id, updatedFields, {
    new: true,
    runValidators: true,
  })
    .then((updated) => {
      if (!updated) {
        return res.status(404).json({ error: "Recept nenalezen" });
      }
      res.json(updated);
    })
    .catch((err) =>
      res.status(500).json({ error: "Chyba při úpravě receptu" }),
    );
});

module.exports = router;
