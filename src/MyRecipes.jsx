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
                <img src="https://i.imgur.com/EZtSp3M.png" />
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
              <img src="https://i.imgur.com/EZtSp3M.png" />
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
