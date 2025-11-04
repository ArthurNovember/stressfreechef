import { Redirect } from "expo-router";

export default function Index() {
  // přesměruje uživatele na hlavní obrazovku (home)
  return <Redirect href="/(tabs)/home" />;
}
