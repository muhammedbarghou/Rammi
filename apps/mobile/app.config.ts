import type { ExpoConfig } from "expo/config";

// Expo loads .env before this runs. The Google plugin refuses to build without the iOS scheme, so it is only added once the iOS client exists.
const iosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;

export default (): ExpoConfig => ({
  name: "Rami",
  slug: "rami",
  version: "1.0.0",
  orientation: "landscape",
  scheme: "rami",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  plugins: iosUrlScheme ? [["@react-native-google-signin/google-signin", { iosUrlScheme }]] : [],
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
