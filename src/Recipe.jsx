import React, { useState, useEffect } from "react";
import "./Recipe.css";
import { useLocation, Link } from "react-router-dom";
const Recipe = () => {
  const location = useLocation();
  const { recipe } = location.state || {};
  const [currentStep, setCurrentStep] = useState(0);

  if (!recipe || !recipe.steps) {
    return (
      <div>
        <p>Recipe not found</p>
        <Link to="/domov">
          <button>Back to HOME</button>
        </Link>
      </div>
    );
  }

  const step = recipe.steps[currentStep];

  return (
    <div className="Recipe">
      <div
        className="recipeBackground"
        style={{
          backgroundImage: `url(${recipe.imgSrc})`,
        }}
      ></div>
      <div className="imgAndTextRecipe">
        <div className="imgContainer">
          {step.type === "image" ? (
            <img src={step.src} />
          ) : (
            <video
              autoplay
              muted
              loop
              className="recipeVideo"
              src={step.src}
              controls
            />
          )}
        </div>
        <div className="buttonAndStep">
          <h3 className="step">Step {currentStep + 1}</h3>
          <p className="instruction">{step.description}</p>
          <div className="buttonContainer">
            {currentStep > 0 ? (
              <button
                className="previousStep"
                onClick={() => setCurrentStep((prev) => prev - 1)}
              >
                PREVIOUS STEP
              </button>
            ) : (
              <p> </p>
            )}
            {currentStep < recipe.steps.length - 1 ? (
              <button
                className="nextStep"
                onClick={() => setCurrentStep((prev) => prev + 1)}
              >
                NEXT STEP
              </button>
            ) : (
              <div>
                <Link to="/domov">
                  <p className="completed">RECIPE COMPLETED</p>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Recipe;
