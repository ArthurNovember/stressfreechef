import { useState, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import ShoppingList from "./ShoppingList";
import Home from "./Home";
import FavoriteItems from "./FavoriteItems";
import Recipe from "./Recipe";
import ExploreRecipes from "./exploreRecipes";

const Recipes = [
  {
    name: "Juicy Grilled Chicken Breast",
    rating: 4.7,
    difficulty: "Beginner",
    time: "60 minutes",
    id: 1,
    imgSrc:
      "https://www.allrecipes.com/thmb/UgUZpaTRGWIHEk57yWMhMEjffiY=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/16160-juicy-grilled-chicken-breasts-ddmfs-5594-hero-3x4-902673c819994c0191442304b40104af.jpg",
    ingredience: [
      "4 skinless and boneless chicken breast halves",
      "¼ cup lemon juice plus wedges for serving",
      "¼ cup olive oil",
      "2 teaspoons dried oregano or parsley",
      "1 teaspoon seasoning salt",
      "½ teaspoon ground black pepper",
      "½ teaspoon onion powder",
    ],
  },

  {
    name: "Pasta with Sausage, Basil, and Mustard",
    rating: 4.6,
    difficulty: "Intermediate",
    time: "20 minutes",
    id: 2,
    imgSrc:
      "https://www.foodandwine.com/thmb/fjNakOY7IcuvZac1hR3JcSo7vzI=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/FAW-recipes-pasta-sausage-basil-and-mustard-hero-06-cfd1c0a2989e474ea7e574a38182bbee.jpg",
    ingredience: [],
  },

  {
    name: "Pork Chops with Apples and Bacon",
    rating: 4.7,
    difficulty: "Hard",
    time: "60 minutes",
    id: 3,
    imgSrc:
      "https://www.foodandwine.com/thmb/p-VjuhHtcC0xjHCVSTW6Cm0F7lc=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/Pork-Chops-with-Apples-and-Bacon-FT-MAG-RECIPE-0924-83dcd0b759534fbbbc8fdf86b706f1f8.jpg",
    ingredience: [],
  },

  {
    name: "Million Dollar Soup",
    rating: 4.5,
    difficulty: "Beginner",
    time: "65 minutes",
    id: 4,
    imgSrc:
      "https://www.southernliving.com/thmb/1NcAJmyqMvFa6YIP1bu4l6Okpq0=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/Million_Dollar_Soup_012-d15952c1533c426b98686010250f231c.jpg",
    ingredience: [],
  },

  {
    name: "Ground Beef and Potatoes",
    rating: 4.3,
    difficulty: "Hard",
    time: "25 minutes",
    id: 5,
    imgSrc:
      "https://www.southernliving.com/thmb/UBogpx6q3cvEFfrfEiGMzaugA9M=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/Ground-beef-and--potatoes_SEO69_Beauty5-3ded67d91eed4fb0a18049286f246248.jpg",
    ingredience: [],
  },

  {
    name: "Bulgogi-Style Tofu",
    rating: 4,
    difficulty: "Intermediate",
    time: "35 minutes",
    id: 6,
    imgSrc:
      "https://static01.nyt.com/images/2022/07/11/dining/ss-bulgogi-style-tofu/merlin_209335170_48189dad-00d2-46b3-8673-e540119aacf3-jumbo.jpg",
    ingredience: [],
  },

  {
    name: "Spinach Frittata",
    rating: 4.9,
    difficulty: "Beginner",
    time: "40 minutes",
    id: 7,
    imgSrc:
      "https://www.simplyrecipes.com/thmb/GxHNBeEJRStjCMZ9Zfgfh7ghJQE=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/Simply-Recipes-Spinach-Frittata-Recipe-Lead-Shot-2b-4da2b79ee2b545078d58054626f03284.jpg",
    ingredience: [],
  },

  {
    name: "Mexican Beef N Rice Skillet",
    rating: 4,
    difficulty: "Hard",
    time: "40 minutes",
    id: 8,
    imgSrc:
      "https://hips.hearstapps.com/hmg-prod/images/mexican-beef-n-rice-skillet1-1665593962.jpg?crop=0.888888888888889xw:1xh;center,top&resize=1200:*",
    ingredience: [],
  },
];

function App() {
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  const openModal = (recipe) => {
    setSelectedRecipe(recipe);
  };
  const closeModal = () => {
    setSelectedRecipe(null);
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const [displayRecipes, setDisplayRecipes] = useState([]);
  useEffect(() => {
    recomendedRecipes();
  }, []);

  const shuffleRecipes = () => {
    const shuffled = [...Recipes].sort(() => Math.random() - 0.5);
    setDisplayRecipes(shuffled);
  };

  const bestSortRecipes = () => {
    const bestSorter = [...Recipes].sort((a, b) => b.id - a.id);
    setDisplayRecipes(bestSorter);
  };

  const favoriteRecipes = () => {
    const favoriteSetter = [...Recipes].sort((a, b) => b.rating - a.rating);
    setDisplayRecipes(favoriteSetter);
  };

  const difficultyOrder = ["Beginner", "Intermediate", "Hard"];
  const recomendedRecipes = () => {
    const recomendedSetter = [...Recipes].sort((a, b) => {
      return (
        difficultyOrder.indexOf(a.difficulty) -
        difficultyOrder.indexOf(b.difficulty)
      );
    });
    setDisplayRecipes(recomendedSetter);
  };

  //Shopping List!!!!!!!!!!!!!!!!!!!!!
  const [text, setText] = useState("");
  const [shop, setShop] = useState([]);
  const [newItem, setNewItem] = useState([]);
  const addItem = (item) => {
    setNewItem((prevItem) => {
      return [...prevItem, item];
    });
  };

  //FavoriteItems!!!!!!!!!!!!!!!!!!!!!!!!!!!
  //array vlastnosí itemu
  const [FavoriteNewItem, setFavoriteNewItem] = useState([]);
  //useState+updatovací funkce textu itemu
  const [FavoriteText, setFavoriteText] = useState("");
  const handleFavoriteText = (event) => {
    setFavoriteText(event.target.value);
  };

  //useState+updatovací funkce shopu itemu
  const [FavoriteShop, setFavoriteShop] = useState([]);
  const handleFavoriteShop = (event) => {
    setFavoriteShop(event.target.value);
  };

  //funkce na přidání itemu
  const addFavoriteItem = (item) => {
    {
      if (!FavoriteNewItem.find((fav) => fav.text === item.text))
        setFavoriteNewItem((prevFavoriteItems) => {
          return [...prevFavoriteItems, item];
        });
    }
  };
  //Funkce mazání itemu
  const deleteFavoriteItem = (itemToDelete) => {
    setFavoriteNewItem((prev) =>
      prev.filter(
        (fav) =>
          fav.text.toLowerCase().trim() !==
          itemToDelete.text.toLowerCase().trim()
      )
    );
  };

  //extra !!!!!!!!!!!!!!!!!!!!!!!!!
  const id = Date.now(); // Unikátní ID pro každou položku
  const uniqueItemNames = [...new Set(newItem.map((item) => item.text))];

  //Shoppy
  const [shopOptions, setShopOptions] = useState(["Albert", "Lidl"]);
  return (
    <Router>
      <div>
        <header>
          <nav>
            <ul>
              <li>
                <Link to="/domov" onClick={scrollToTop}>
                  Home
                </Link>
              </li>
              <li>
                <Link to="/ExploreRecipes">Explore Recipes</Link>
              </li>
              <li>
                <a href="#myRecipes">My Recipes</a>
              </li>
              <li>
                <Link to="/shopping-list">Shopping List</Link>
              </li>
              <li id="nav">
                <a href="#myProfile">My Profile</a>
              </li>
            </ul>
          </nav>
        </header>
      </div>
      <Routes>
        <Route
          path="/"
          element={
            <Home
              displayRecipes={displayRecipes}
              openModal={openModal}
              selectedRecipe={selectedRecipe}
              recomendedRecipes={recomendedRecipes}
              bestSortRecipes={bestSortRecipes}
              favoriteRecipes={favoriteRecipes}
              shuffleRecipes={shuffleRecipes}
              addItem={addItem}
              setNewItem={setNewItem}
              newItem={newItem}
            />
          }
        />

        <Route
          path="/shopping-list"
          element={
            <ShoppingList
              text={text}
              setText={setText}
              shop={shop}
              setShop={setShop}
              newItem={newItem}
              setNewItem={setNewItem}
              addItem={addItem}
              id={id}
              addFavoriteItem={addFavoriteItem}
              FavoriteNewItem={FavoriteNewItem}
              setFavoriteNewItem={setFavoriteNewItem}
              deleteFavoriteItem={deleteFavoriteItem}
              shopOptions={shopOptions}
              setShopOptions={setShopOptions}
              uniqueItemNames={uniqueItemNames}
            />
          }
        />

        <Route
          path="/domov"
          element={
            <Home
              displayRecipes={displayRecipes}
              openModal={openModal}
              selectedRecipe={selectedRecipe}
              recomendedRecipes={recomendedRecipes}
              bestSortRecipes={bestSortRecipes}
              favoriteRecipes={favoriteRecipes}
              shuffleRecipes={shuffleRecipes}
              addItem={addItem}
              setNewItem={setNewItem}
              newItem={newItem}
            />
          }
        />
        <Route
          path="/favoriteItems"
          element={
            <FavoriteItems
              FavoriteNewItem={FavoriteNewItem}
              setFavoriteNewItem={setFavoriteNewItem}
              FavoriteText={FavoriteText}
              setFavoriteText={setFavoriteText}
              handleFavoriteText={handleFavoriteText}
              FavoriteShop={FavoriteShop}
              setFavoriteShop={setFavoriteShop}
              handleFavoriteShop={handleFavoriteShop}
              addFavoriteItem={addFavoriteItem}
              addItem={addItem}
              deleteFavoriteItem={deleteFavoriteItem}
              shopOptions={shopOptions}
              setShopOptions={setShopOptions}
              uniqueItemNames={uniqueItemNames}
            />
          }
        />
        <Route path="/Recipe" element={<Recipe />} />

        <Route path="ExploreRecipes" element={<ExploreRecipes />} />
      </Routes>
    </Router>
  );
}

export default App;
