import React, { useState, useEffect } from "react";
import "./NewRecipe.css";
const NewRecipe = () => {
  return (
    <div className="new">
      <div className="mainInfo">
        <div className="inputAdd">
          <label>
            <p>Name of the Recipe: </p>
          </label>
          <input></input>
        </div>
        <div className="inputAdd">
          <label>
            <p>Difficulty</p>
          </label>
          <input></input>
        </div>
        <div className="inputAdd">
          <label>
            <p>Time</p>
          </label>
          <input></input>
        </div>
        <div className="uploadContainer">
          <label for="uploadID">Upload Thumbnail</label>
          <input id="uploadID" className="uploads" type="file"></input>
        </div>
      </div>
    </div>
  );
};

export default NewRecipe;
