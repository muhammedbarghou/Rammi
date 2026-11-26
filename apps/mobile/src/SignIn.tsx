import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { env, supabase } from "./supabase";
import { ui } from "./ui";

/** F1: Google only for now (Apple comes later), no passwords. Name and photo come from the social account. */
export function SignIn() {
  const [error, setError] = useState("");

  // Native Google sign-in, then Supabase checks the ID token. Needs a development build, not Expo Go.
  const google = async () => {
    setError("");
    // Loaded on tap, not at startup: Expo Go has no native Google module and would crash on import.
    const g = await import("@react-native-google-signin/google-signin").catch(() => null);
    if (!g) return setError("Google sign-in needs a development build, not Expo Go");
    const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = g;
    try {
      // The web client id makes Google issue an ID token for Supabase. The iOS client id is only needed on iOS.
      GoogleSignin.configure({
        webClientId: env("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID", process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
      });
      await GoogleSignin.hasPlayServices();
      const res = await GoogleSignin.signIn();
      if (!isSuccessResponse(res)) return; // cancelled
      const token = res.data.idToken;
      if (!token) throw new Error("Google sign-in returned no ID token");
      const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token });
      if (error) throw error;
    } catch (e) {
      if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) return; // second tap while the sheet is open
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const testPlayer = async () => {
    setError("");
    const full_name = `Tester ${Math.floor(1000 + Math.random() * 9000)}`;
    const { error } = await supabase.auth.signInAnonymously({ options: { data: { full_name } } });
    if (error) setError(error.message);
  };

  return (
    <View style={ui.screen}>
      <Text style={ui.title}>Rami · Talaj 71</Text>
      <Pressable style={ui.button} onPress={google}>
        <Text style={ui.buttonText}>Sign in with Google</Text>
      </Pressable>
      {__DEV__ && (
        // Development only, never in a release build: one anonymous Supabase account per device, to test a full table alone.
        <Pressable style={ui.button} onPress={testPlayer}>
          <Text style={ui.buttonText}>Sign in as test player</Text>
        </Pressable>
      )}
      {!!error && <Text style={ui.error}>{error}</Text>}
    </View>
  );
}
