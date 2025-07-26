import React, { useState, useEffect } from "react";
import "./exploreRecipes.css";
const ExploreRecipes = () => {
  return (
    <div className="explore">
      <h2>EXPLORE RECIPES</h2>
      <div className="searchAndViews">
        <div className="views">
          <button>GRID VIEW</button>
          <button>SWIPE VIEW</button>
        </div>

        <input type="text" placeholder="  Search recipes..." />
        <button className="searchButton">
          {" "}
          <i className="fas fa-search"></i> Search
        </button>
      </div>
      <div className="recipeContainer1">
        <div className="recipeCard1">
          <a href="#forNow">
            <img src="https://i.imgur.com/EZtSp3M.png" />
          </a>
          <h3>NAme</h3>
          <p>Rating: ⭐</p>
          <p>Difficulty: Hard</p>
          <p>Time: 90minutes⏱️</p>
        </div>
      </div>
    </div>
  );
};

export default ExploreRecipes;
