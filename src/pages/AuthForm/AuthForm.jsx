import { useState } from "react";
import "./AuthForm.css";
import { useNavigate } from "react-router-dom";
import { login, register } from "../../api/auth";
import { useAuth } from "../../context/AuthContext";
import { useShopping } from "../../context/ShoppingContext";
import { useFavorites } from "../../context/FavoritesContext";

const AuthForm = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { refresh: refreshShopping } = useShopping();
  const { refresh: refreshFavorites } = useFavorites();

  const [mode, setMode] = useState("signup");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  async function handleSignup() {
    if (!validateSignup()) return;
    try {
      await register(username, email, password);
      alert("Registration successful. You can now log in.");
      setMode("login");
    } catch (err) {
      alert(err.message || "Server communication error.");
    }
  }

  async function handleLogin() {
    if (!validateLogin()) return;
    try {
      const data = await login(email, password);
      localStorage.setItem("token", data.token);
      await Promise.all([refreshUser(), refreshShopping(), refreshFavorites()]);
      navigate("/myprofile");
    } catch (err) {
      alert(err.message || "Server communication error.");
    }
  }

  return (
    <div className="authfull">
      <div className="FormContainer">
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
