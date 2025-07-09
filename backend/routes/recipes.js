const express = require('express');
const router = express.Router();
const Recipe = require('../models/Recipe');


const recipes = [
  { id: 1, title: 'Palačinky' },
  { id: 2, title: 'Smažený sýr' }
];

router.get('/api/recipes', (req, res) => {
  Recipe.find()
  .then(recipes => res.json(recipes))
  .catch(err => res.status(500).json({ error: 'Chyba při načítání receptů' }));

});
router.post('/api/recipes', (req, res) => {
const { title } = req.body;
  // ✅ VALIDACE
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'Chybí název receptu nebo je neplatný' });
  }
  // ✅ Vytvoř nový dokument podle modelu
  const newRecipe = new Recipe({ title: title.trim() });
  newRecipe.save()
    .then(saved => res.status(201).json(saved))
    .catch(err => res.status(500).json({ error: 'Chyba při ukládání receptu' }));
});


router.delete('/api/recipes/:id', (req,res)=> {
Recipe.findByIdAndDelete(req.params.id)
  .then(deleted => {
    if (!deleted) {
      return res.status(404).json({ error: 'Recept nenalezen' });
    }
    res.status(204).send();
  })
  .catch(err => res.status(500).json({ error: 'Chyba při mazání receptu' }));

} );

router.patch('/api/recipes/:id', (req, res) => {
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