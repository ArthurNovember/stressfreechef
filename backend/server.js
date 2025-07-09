const express = require('express');
require('dotenv').config(); // Načti .env soubor
const mongoose = require('mongoose'); // Import Mongoose

// Připojení k MongoDB
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log('✅ Připojeno k MongoDB'))
  .catch((err) => console.error('❌ Nepodařilo se připojit k MongoDB:', err));

const app = express();
const PORT = 4000;

app.use(express.json());


// ✅ Připoj router
const recipesRouter = require('./routes/recipes');
app.use('/api/recipes', recipesRouter);



app.get('/', (req, res) => {
  res.send('Backend běží!');
});
app.listen(PORT, () => {
  console.log(`✅ Server běží na portu ${PORT}`);
});