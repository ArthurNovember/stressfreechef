import React, { useState, useEffect } from "react";
import "./NewRecipe.css";
const NewRecipe = () => {
  const [preview, setPreview] = useState(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
    }
  };
  return (
    <div className="new">
      <div className="mainInfo">
        <div className="nameDifTime">
          <div className="inputAdd">
            <label>
              <p>Name of the Recipe: </p>
            </label>
            <input type="text" placeholder="Title..."></input>
          </div>
          <div className="inputAdd">
            <label>
              <p>Difficulty</p>
            </label>
            <select>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
          <div className="inputAdd">
            <label>
              <p>Time</p>
            </label>
            <input type="time"></input>
          </div>
        </div>
        <label for="uploadID">
          <div className="uploadContainer">
            {/* Placeholder s obrázkem */}
            <div className="imagePreview">
              {preview ? (
                <img src={preview} alt="Preview" />
              ) : (
                <p>Upload Recipe Thumbnail</p>
              )}
            </div>
            <input
              id="uploadID"
              className="uploads"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              hidden
            />
          </div>
        </label>

        <button>ADD RECIPE</button>
      </div>
      <div className="stepsAndIngrents">
        <div className="Steps">
          <h3>STEPS</h3>
          <ol>
            <li>Gather ingredients</li>
            <li>
              <input></input>
            </li>
          </ol>
        </div>

        <div className="Ingredients">
          <h3>INGREDIENTS</h3>
          <ol>
            <li>Chicken</li>
            <li>
              <input></input>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default NewRecipe;
