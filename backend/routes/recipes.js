const express = require('express');
const router = express.Router();
const Recipe = require('../models/Recipe');


router.get('/', async (req, res) => {
const filter = {};
if (req.query.search) {
  filter.title = { $regex: req.query.search, $options: 'i' };
}

if (req.query.difficulty) {
  filter.difficulty = req.query.difficulty;
}

if (req.query.maxTime) {
  filter.time = { $lte: Number(req.query.maxTime) };
}

const sortField = req.query.sortBy || 'title';
const sortOrder = req.query.order === 'desc' ? -1 : 1;

const limit = Number(req.query.limit) || 10;
const page = Number(req.query.page) || 1;

let query = Recipe.find(filter)
  .sort({ [sortField]: sortOrder })
  .skip((page - 1) * limit)
  .limit(limit);

  if (req.query.fields) {
  const fields = req.query.fields.split(',').join(' ');
  query = query.select(fields);
}

try {
  const results = await query;
  res.json(results);
} catch (err) {
  res.status(500).json({ error: 'Chyba při získávání receptů' });
}

});


router.post('/', async (req, res) => {
  const {
    title,
    rating,
    difficulty,
    time,
    imgSrc,
    ingredients,
    steps
  } = req.body;

  try {
    const newRecipe = new Recipe({
      title,
      rating,
      difficulty,
      time,
      imgSrc,
      ingredients,
      steps
    });

    await newRecipe.save();
    res.status(201).json(newRecipe);
  } catch (error) {
    console.error('Chyba při ukládání receptu:', error);
    res.status(500).json({ error: 'Chyba při ukládání receptu' });
  }
});



router.delete('/:id', (req,res)=> {
Recipe.findByIdAndDelete(req.params.id)
  .then(deleted => {
    if (!deleted) {
      return res.status(404).json({ error: 'Recept nenalezen' });
    }
    res.status(204).send();
  })
  .catch(err => res.status(500).json({ error: 'Chyba při mazání receptu' }));

} );

router.patch('/:id', (req, res) => {
const updatedFields = req.body;
if ('title' in updatedFields) {
  if (
    typeof updatedFields.title !== 'string' ||
    updatedFields.title.trim() === ''
  ) {
    return res.status(400).json({ error: 'Nový název receptu je neplatný.' });
  }
  updatedFields.title = updatedFields.title.trim();
}
Recipe.findByIdAndUpdate(
  req.params.id,
  updatedFields,
  { new: true, runValidators: true }
)
  .then(updated => {
    if (!updated) {
      return res.status(404).json({ error: 'Recept nenalezen' });
    }
    res.json(updated);
  })
  .catch(err => res.status(500).json({ error: 'Chyba při úpravě receptu' }));

});

module.exports = router;