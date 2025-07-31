import React, { useState, useEffect } from "react";
import "./AuthForm.css";
import { Link } from "react-router-dom";
const AuthForm = () => {
  return (
   <div>
   <div className="FormContainer">
          <button className="formStyleA" >SIGN UP</button>
          <button className="formStyleB">LOG IN</button>
          <div className="labelWithInputs">
        <div className="labelWithInput">
          <label>Username:</label>
          <input className="formInput"></input>
         </div>
          <div className="labelWithInput">
          <label>Email:</label>
          <input className="formInput"></input>
         </div>
        <div className="labelWithInput">
          <label>Password:</label>
          <input className="formInput"></input>
          </div>
         
          <div className="labelWithInput">
          <label>Confirm Password:</label>
          <input className="formInput"></input>
          </div>
          </div>
          <button className="signup">SIGN UP</button>
    </div>
    

    
    </div>
  );
};

export default AuthForm;
