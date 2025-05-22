import React, { useState, useEffect } from "react";
import "./Recipe.css";
const Recipe = () => {
  return (
    <div className="Recipe">
      <div className="imgContainer">
        <img src="https://www.allrecipes.com/thmb/Vw5kItdm0Hk3Kl6NSIKf3xg59UM=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/16160-juicy-grilled-chicken-breasts-ddmfs-5528-01-3x4-fde4b162c1e74b82a8ca94cbad082ae8.jpg" />
      </div>
      <h3 className="step">Step 1</h3>
      <p className="instruction">Gather the ingredients</p>
      <div className="buttonContainer">
        <button className="nextStep">NEXT STEP</button>
      </div>
    </div>
  );
};

export default Recipe;
