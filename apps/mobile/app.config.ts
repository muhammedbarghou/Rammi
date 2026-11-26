import type { ExpoConfig } from "expo/config";

export default (): ExpoConfig => ({
  name: "Rami",
  slug: "rami",
  version: "1.0.0",
  orientation: "landscape",
  scheme: "rami", // sign-in redirect back into the app
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  ios: { bundleIdentifier: "com.rami.talaj71", supportsTablet: true },
  android: {
    package: "com.rami.talaj71",
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
  },
});
