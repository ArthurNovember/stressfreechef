import React from "react";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "../theme/ThemeContext";
import { LanguageProvider } from "../i18n/LanguageContext";

import * as Font from "expo-font";

function RootWithStatusBar() {
  const { theme } = useTheme();

  return (
    <>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = Font.useFonts({
    Metropolis: require("../assets/fonts/Metropolis-Regular.otf"),
    MetropolisMedium: require("../assets/fonts/Metropolis-Medium.otf"),
    MetropolisSemiBold: require("../assets/fonts/Metropolis-SemiBold.otf"),
    MetropolisBold: require("../assets/fonts/Metropolis-Bold.otf"),
  });

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <LanguageProvider>
        <RootWithStatusBar />
      </LanguageProvider>
    </ThemeProvider>
  );
}
