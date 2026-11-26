import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { supabase } from "./supabase";
import { ui } from "./ui";

/** F1: Google only for now (Apple comes later), no passwords. Name and photo come from the social account. */
export function SignIn() {
  const [error, setError] = useState("");

  // Browser sign-in through Supabase, so it also runs in Expo Go (no native Google module).
  const google = async () => {
    setError("");
    try {
      const redirectTo = Linking.createURL("auth"); // exp://… in Expo Go, rami://auth in a build
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo, skipBrowserRedirect: true } });
      if (error) throw error;
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type !== "success") return; // cancelled
      const code = Linking.parse(res.url).queryParams?.code;
      if (typeof code !== "string") throw new Error("Google sign-in returned no code");
      const { error: e2 } = await supabase.auth.exchangeCodeForSession(code);
      if (e2) throw e2;
    } catch (e) {
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
