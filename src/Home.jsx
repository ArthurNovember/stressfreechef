import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const Home = ({
  displayRecipes,
  recommendedRecipes,
  bestSortRecipes,
  favoriteRecipes,
  shuffleRecipes,
  addItem,
  setNewItem,
  NewItem,
}) => {
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  const openModal = (recipe) => {
    setSelectedRecipe(recipe);
  };
  const closeModal = () => {
    setSelectedRecipe(null);
  };

  useEffect(() => {
    if (selectedRecipe) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [selectedRecipe]);

  const [animateLogo, setAnimateLogo] = useState(false);
  const handleHover = () => {
    setAnimateLogo(true);
  };
  const handleAnimationEnd = () => {
    setAnimateLogo(false);
  };

  return (
    <main>
      <div className="main">
        <div className="logoText">
          <img
            src="https://i.imgur.com/EdgU8NN.png"
            className={`logo ${animateLogo ? "animate" : ""}`}
            onMouseEnter={handleHover}
            onAnimationEnd={handleAnimationEnd}
          />
          <p>Stress Free Chef</p>
        </div>
        <input type="text" placeholder="  Search recipes..." />
        <button className="searchButton">
          {" "}
          <i className="fas fa-search"></i> Search
        </button>
        <br />
        <br />
        <br />
        <section className="variants">
          <ul className="HomeUl">
            <li>
              <a href="#recommended" onClick={recommendedRecipes}>
                RECOMMENDED
              </a>
            </li>
            <li>
              <a href="#newest" onClick={bestSortRecipes}>
                NEWEST
              </a>
            </li>
            <li>
              <a href="#favorite" onClick={favoriteRecipes}>
                FAVORITE
              </a>
            </li>
            <li>
              <a href="#random" onClick={shuffleRecipes}>
                RANDOM
              </a>
            </li>
          </ul>
        </section>

        <div className="recipeContainer">
          {displayRecipes.map((recipe) => (
            <div className="recipeCard" key={recipe.id}>
              <a href="#forNow">
                <img onClick={() => openModal(recipe)} src={recipe.imgSrc} />
              </a>
              <h3>{recipe.title}</h3>
              <p>Rating: {recipe.rating}⭐</p>
              <p className={recipe.difficulty}>
                Difficulty: {recipe.difficulty}
              </p>
              <p>Time: {recipe.time}⏱️</p>
            </div>
          ))}
        </div>

        {selectedRecipe && (
          <div className="modalOverlay" onClick={() => setSelectedRecipe(null)}>
            <div
              className="selectedRecipeContainer"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <div id="forNow">
                <div className="nameAndPicture">
                  <h2>{selectedRecipe.title}</h2>
                  <img src={selectedRecipe.imgSrc} />
                </div>

                <div className="displayIngredience">
                  <ol>
                    {selectedRecipe.ingredients.map((ingredient, index) => {
                      return (
                        <li key={index}>
                          {" "}
                          <input type="checkbox" /> {ingredient}{" "}
                          <button
                            className="sendToList"
                            onClick={() =>
                              addItem({
                                text: ingredient,
                                shop: [],
                              })
                            }
                          >
                            Send to shopping list
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
              <div id="startparent">
                <Link to="/Recipe" state={{ recipe: selectedRecipe }}>
                  <button className="getStarted">GET STARTED</button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default Home;
