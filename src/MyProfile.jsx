import React, { useEffect, useState } from "react";
import AuthForm from "./AuthForm";

const MyProfile = ({ userInfo }) => {
  if (!userInfo) return <div>Načítám...</div>;
  const handleLogout = () => {
    localStorage.removeItem("token"); // smaže token
    window.location.href = "/AuthForm"; // přesměruje na přihlášení
  };

  return (
    <div>
      <h2>Vítej, {userInfo.username}!</h2>
      <p>Email: {userInfo.email}</p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
};

export default MyProfile;
