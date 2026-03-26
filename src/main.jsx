import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ShoppingProvider } from "./context/ShoppingContext.jsx";
import { FavoritesProvider } from "./context/FavoritesContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <ShoppingProvider>
        <FavoritesProvider>
          <App />
        </FavoritesProvider>
      </ShoppingProvider>
    </AuthProvider>
  </StrictMode>,
);
