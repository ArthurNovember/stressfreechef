import "dotenv/config";

export default {
  expo: {
    name: "Stress Free Chef",
    slug: "stressfreechef-mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.anonymous.stressfreechefmobile",
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: ["expo-router", "expo-secure-store", "expo-font"],
    extra: {
      apiBase: process.env.EXPO_PUBLIC_API_BASE,
      eas: {
        projectId: "d173f2e2-5c7e-454a-bf84-edc2dd78462a",
      },
    },
  },
};
