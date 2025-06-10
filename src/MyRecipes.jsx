import React, { useState, useEffect } from "react";
import "./MyRecipes.css";
import { Link } from "react-router-dom";
const MyRecipes = () => {
  return (
    <div className="My">
      <div className="savedRecipes">
        <div className="MyRecipeNewRecipe">
          <h2 className="MyCategory">SAVED RECIPES</h2>
        </div>

        <div className="recipeContainer2">
          <div className="recipeCard2">
            <div>
              <a href="#forNow">
                <img src="https://www.southernliving.com/thmb/1NcAJmyqMvFa6YIP1bu4l6Okpq0=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/Million_Dollar_Soup_012-d15952c1533c426b98686010250f231c.jpg" />
              </a>
            </div>
            <div className="texto">
              <h3>NAme</h3>
              <p>Rating: ⭐</p>
              <p>Difficulty: Hard</p>
              <p>Time: 90minutes⏱️</p>
            </div>
          </div>
        </div>
      </div>
      <div className="myRecipes">
        <div className="MyRecipeNewRecipe">
          <h2 className="MyCategory"> MY RECIPES</h2>
          <Link to="/NewRecipe">
            <button className="newRecipe">ADD NEW RECIPE</button>
          </Link>
        </div>
        <div className="recipeContainer2">
          <div className="recipeCard2">
            <a href="#forNow">
              <img src="https://www.simplyrecipes.com/thmb/GxHNBeEJRStjCMZ9Zfgfh7ghJQE=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/Simply-Recipes-Spinach-Frittata-Recipe-Lead-Shot-2b-4da2b79ee2b545078d58054626f03284.jpg" />
            </a>
            <div className="texto">
              <h3>NAme</h3>
              <p>Rating: ⭐</p>
              <p>Difficulty: Hard</p>
              <p>Time: 90minutes⏱️</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyRecipes;
