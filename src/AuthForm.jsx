import React, { useState, useEffect } from "react";
import "./AuthForm.css";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";

const AuthForm = () => {
  const [isSignUp, setIsSignUp] = useState(true);
  const [isLogin, setIsLogin] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate(); // 🎯 přidat pod useState

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      alert("Hesla se neshodují.");
      return;
    }

    try {
      const response = await fetch(
        "https://stressfreecheff-backend.onrender.com/api/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, email, password }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert("Registrace proběhla úspěšně.");
        setIsSignUp(false); // Přepne tě na login
        setIsLogin(true);
      } else {
        alert(data.error || "Chyba při registraci.");
      }
    } catch (error) {
      alert("Chyba při komunikaci se serverem.");
    }
  };

  const handleLogin = async () => {
    try {
      const response = await fetch(
        "https://stressfreecheff-backend.onrender.com/api/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert("Přihlášení úspěšné!");
        localStorage.setItem("token", data.token); // 🎯 uloží token
        navigate("/myprofile"); // 🎯 přesměruje na stránku s profilem
      } else {
        alert(data.error || "Chyba při přihlašování.");
      }
    } catch (error) {
      alert("Chyba při komunikaci se serverem.");
    }
  };

  return (
    <div>
      <div className="FormContainer">
        <button
          style={{
            backgroundColor: isSignUp ? "rgb(139, 14, 13)" : "rgb(46, 45, 45)",
          }}
          className="formStyleA"
          onClick={() => {
            setIsSignUp(true);
            setIsLogin(false);
          }}
        >
          SIGN UP
        </button>
        <button
          style={{
            backgroundColor: isLogin ? "rgb(139, 14, 13)" : "rgb(46, 45, 45)",
          }}
          className="formStyleB"
          onClick={() => {
            setIsLogin(true);
            setIsSignUp(false);
          }}
        >
          LOG IN
        </button>

        {isSignUp && (
          <div className="signOption">
            <div className="labelWithInputs">
              <div className="labelWithInput">
                <label>Username:</label>
                <input
                  className="formInput"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                ></input>
              </div>
              <div className="labelWithInput">
                <label>Email:</label>
                <input
                  className="formInput"
                  type="email "
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                ></input>
              </div>
              <div className="labelWithInput">
                <label>Password:</label>
                <input
                  className="formInput"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                ></input>
              </div>

              <div className="labelWithInput">
                <label>Confirm Password:</label>
                <input
                  className="formInput"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                ></input>
              </div>
            </div>
            <button className="signup" onClick={handleSignup}>
              SIGN UP
            </button>
          </div>
        )}

        {isLogin && (
          <div className="signOption">
            <div className="labelWithInputs">
              <div className="labelWithInput">
                <label>Email:</label>
                <input
                  className="formInput"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                ></input>
              </div>
              <div className="labelWithInput">
                <label>Password:</label>
                <input
                  className="formInput"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                ></input>
              </div>
            </div>
            <button className="signup" onClick={handleLogin}>
              LOG IN
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthForm;
