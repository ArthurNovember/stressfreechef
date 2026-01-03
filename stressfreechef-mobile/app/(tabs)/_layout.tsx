import React, { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { t, Lang, LANG_KEY } from "../../i18n/strings";
import { useTheme } from "../../theme/ThemeContext";

/* -----------------------------
   Helpers
----------------------------- */
async function loadStoredLang(): Promise<Lang> {
  const stored = await AsyncStorage.getItem(LANG_KEY);
  return stored === "cs" || stored === "en" ? stored : "cs";
}

/* -----------------------------
   Layout
----------------------------- */
export default function Layout() {
  const [lang, setLang] = useState<Lang>("cs");
  const { colors } = useTheme();

  useEffect(() => {
    loadStoredLang().then(setLang);
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.pillActive,
        tabBarInactiveTintColor: colors.text,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t(lang, "tabs", "home"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: t(lang, "tabs", "community"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="NewRecipe"
        options={{
          title: t(lang, "tabs", "addRecipe"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="shopping"
        options={{
          title: t(lang, "tabs", "shopping"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: t(lang, "tabs", "profile"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
