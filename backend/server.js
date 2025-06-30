const express = require('express');
const app = express();
const PORT = 4000;

app.use(express.json());

const recipes = [
  { id: 1, title: 'Palačinky' },
  { id: 2, title: 'Smažený sýr' }
];

app.get('/api/recipes', (req, res) => {
  res.json(recipes);
});
app.post('/api/recipes', (req, res) => {
  const newRecipe = req.body;
  recipes.push(newRecipe);
  res.status(201).json(newRecipe);
});

app.delete('/api/recipes/:id', (req,res)=> {
  const id= Number(req.params.id);
  const index= recipes.findIndex(recipe=> recipe.id===id);
  if (index===-1) {return res.status(404).send({error:'Recept nenalezen'})};
  recipes.splice(index,1);
  res.status(204).send();

} );

app.patch('/api/recipes/:id', (req, res) => {
  const id = Number(req.params.id);
  const recipe = recipes.find(r => r.id === id);
  if (!recipe) {
    return res.status(404).send({ error: 'Recept nenalezen' });
  }
  const updatedFields = req.body;
  Object.assign(recipe, updatedFields); 
  res.json(recipe);
});



app.get('/', (req, res) => {
  res.send('Backend běží!');
});
app.listen(PORT, () => {
  console.log(`✅ Server běží na portu ${PORT}`);
});