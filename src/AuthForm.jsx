import React, { useState, useEffect } from "react";
import "./AuthForm.css";
import { Link } from "react-router-dom";



const AuthForm = () => {
 const [isSignUp,setIsSignUp]=useState(true);
 const [isLogin,setIsLogin]=useState(false);
  return (
   <div>
   <div className="FormContainer">
          <button className="formStyleA" onClick={()=>{setIsSignUp(true); setIsLogin(false)}}>SIGN UP</button>
          <button className="formStyleB" onClick={()=>{setIsLogin(true); setIsSignUp(false)}}>LOG IN</button>
        
        {isSignUp && (
        <div className="signOption">
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
          <input className="formInput" type="password"></input>
          </div>
         
          <div className="labelWithInput">
          <label>Confirm Password:</label>
          <input className="formInput" type="password"></input>
          </div>
          </div>
          <button className="signup">SIGN UP</button>
    </div>)}


            {isLogin && (
        <div className="signOption">
          <div className="labelWithInputs">

          <div className="labelWithInput">
          <label>Email:</label>
          <input className="formInput"></input>
         </div>
        <div className="labelWithInput">
          <label>Password:</label>
          <input className="formInput" type="password"></input>
          </div>

          </div>
          <button className="signup">LOG IN</button>
    </div>)}
    
</div>
    
    </div>
  );
};

export default AuthForm;
