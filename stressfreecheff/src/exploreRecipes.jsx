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
            <img src="https://www.southernliving.com/thmb/1NcAJmyqMvFa6YIP1bu4l6Okpq0=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/Million_Dollar_Soup_012-d15952c1533c426b98686010250f231c.jpg" />
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
