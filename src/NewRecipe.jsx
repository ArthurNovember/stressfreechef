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

  const [stepPreview, setStepPreview] = useState(null);

  const handleStepFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setStepPreview(URL.createObjectURL(file));
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

        <img className="addRecipe" src="https://i.imgur.com/wPktOjd.png"></img>
        <div className="public">
          <select>
            <option type="radio">Public</option>
            <option type="radio">Private</option>
          </select>
        </div>
      </div>
      <div className="stepsAndIngrents">
        <div className="Steps">
          <h3>STEPS</h3>
          <ol>
            <li>
              <input value="Gather ingredients"></input>
              <div className="uploadContainer">
                {/* Placeholder s obrázkem */}
                <div className="imagePreview">
                  <img src="https://i.imgur.com/ncCfTUM.png" alt="Preview" />
                </div>
              </div>
              <button className="X">X</button>
            </li>
            <li className="addStep">
              <input></input>
              <div className="photoAndButton">
                <label for="uploadStepID">
                  <div className="uploadContainer">
                    {/* Placeholder s obrázkem */}
                    <div className="imagePreview">
                      {stepPreview ? (
                        <img src={stepPreview} alt="Preview" />
                      ) : (
                        <p>Upload Step Thumbnail</p>
                      )}
                    </div>
                    <input
                      id="uploadStepID"
                      className="uploads"
                      type="file"
                      accept="image/*"
                      onChange={handleStepFileChange}
                      hidden
                    />
                  </div>
                </label>

                <button>Add Step</button>
              </div>
            </li>
          </ol>
        </div>

        <div className="Ingredients">
          <h3>INGREDIENTS</h3>
          <ol>
            <li>
              <input value="chicken"></input>
            </li>
            <li className="inputWithButton">
              <input></input>
              <button className="AddIngredient">Add Ingredient</button>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default NewRecipe;
