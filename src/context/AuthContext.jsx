import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getProfile } from "../api/auth";
import { getToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [userInfo, setUserInfo] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUserInfo(null);
      setAuthReady(true);
      return;
    }
    try {
      const user = await getProfile();
      setUserInfo(user);
    } catch {
      localStorage.removeItem("token");
      setUserInfo(null);
    } finally {
      setAuthReady(true);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUserInfo(null);
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ userInfo, authReady, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
