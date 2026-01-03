import { useState } from "react";
import "./AuthForm.css";
import { useNavigate } from "react-router-dom";

/* -----------------------------
   API config
----------------------------- */
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "https://stressfreecheff-backend.onrender.com";

/* -----------------------------
   Component
----------------------------- */
const AuthForm = ({ onLoginSuccess }) => {
  const navigate = useNavigate();

  /* =============================
     State – mode
  ============================= */
  // "signup" | "login"
  const [mode, setMode] = useState("signup");

  /* =============================
     State – form fields
  ============================= */
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  /* =============================
     Helpers – validation
  ============================= */
  function validateSignup() {
    if (!username.trim() || !email.trim() || !password.trim()) {
      alert("Please fill in all required fields.");
      return false;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return false;
    }
    return true;
  }

  function validateLogin() {
    if (!email.trim() || !password.trim()) {
      alert("Please enter email and password.");
      return false;
    }
    return true;
  }

  /* =============================
     Actions – signup
  ============================= */
  async function handleSignup() {
    if (!validateSignup()) return;

    try {
      const res = await fetch(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Registration error.");
        return;
      }

      alert("Registration successful. You can now log in.");
      setMode("login");
    } catch {
      alert("Server communication error.");
    }
  }

  /* =============================
     Actions – login
  ============================= */
  async function handleLogin() {
    if (!validateLogin()) return;

    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Login error.");
        return;
      }

      localStorage.setItem("token", data.token);
      onLoginSuccess?.();
      navigate("/myprofile");
    } catch {
      alert("Server communication error.");
    }
  }

  /* =============================
     Render
  ============================= */
  return (
    <div className="authfull">
      <div className="FormContainer">
        {/* MODE SWITCH */}
        <button
          className="formStyleA"
          style={{
            backgroundColor:
              mode === "signup" ? "rgb(139, 14, 13)" : "rgb(46, 45, 45)",
          }}
          onClick={() => setMode("signup")}
        >
          SIGN UP
        </button>

        <button
          className="formStyleB"
          style={{
            backgroundColor:
              mode === "login" ? "rgb(139, 14, 13)" : "rgb(46, 45, 45)",
          }}
          onClick={() => setMode("login")}
        >
          LOG IN
        </button>

        {/* SIGN UP */}
        {mode === "signup" && (
          <div className="signOption">
            <div className="labelWithInputs">
              <div className="labelWithInput">
                <label>Username:</label>
                <input
                  className="formInput"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="labelWithInput">
                <label>Email:</label>
                <input
                  className="formInput"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="labelWithInput">
                <label>Password:</label>
                <input
                  className="formInput"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="labelWithInput">
                <label>Confirm Password:</label>
                <input
                  className="formInput"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <button className="signup" onClick={handleSignup}>
              SIGN UP
            </button>
          </div>
        )}

        {/* LOG IN */}
        {mode === "login" && (
          <div className="signOption">
            <div className="labelWithInputs">
              <div className="labelWithInput">
                <label>Email:</label>
                <input
                  className="formInput"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="labelWithInput">
                <label>Password:</label>
                <input
                  className="formInput"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
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
