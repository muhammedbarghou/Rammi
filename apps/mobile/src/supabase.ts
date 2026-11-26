import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

const env = (name: string, value: string | undefined) => {
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

export const supabase = createClient(
  env("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL),
  env("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: "pkce" } },
);

// Refresh tokens only while the app is in the foreground.
AppState.addEventListener("change", (s) => (s === "active" ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh()));

export const SERVER_URL = env("EXPO_PUBLIC_SERVER_URL", process.env.EXPO_PUBLIC_SERVER_URL);
