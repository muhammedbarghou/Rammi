import { StyleSheet } from "react-native";

/** Colour tokens from the UI spec. Gold is kept for important game states. */
export const C = {
  bg: "#0B241B",
  table: "#123F2D",
  felt: "#18553C",
  surface: "#111827",
  gold: "#D4AF37",
  amber: "#E0A030",
  ivory: "#F5F1E8",
  muted: "#94A3B8",
  red: "#C62828",
  black: "#171717",
  line: "#ffffff1f",
  teamA: "#6B8CC7",
  teamB: "#D4AF37",
};

/** Inter, loaded in App.tsx. A custom family carries its own weight, so no fontWeight. */
export const F = { regular: "Inter_400Regular", semi: "Inter_600SemiBold", bold: "Inter_700Bold" };

/** Shared styles for the screens outside the table. */
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", gap: 12, padding: 16 },
  title: { color: C.ivory, fontSize: 26, fontFamily: F.semi },
  text: { color: C.ivory, fontSize: 15, fontFamily: F.regular },
  button: { backgroundColor: C.gold, paddingHorizontal: 20, minHeight: 44, borderRadius: 12, minWidth: 120, alignItems: "center", justifyContent: "center" },
  buttonText: { color: C.surface, fontSize: 15, fontFamily: F.semi },
  disabled: { opacity: 0.4 },
  error: { color: "#F2A7A7", fontSize: 14, fontFamily: F.regular },
  input: { backgroundColor: C.surface, color: C.ivory, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, height: 44, minWidth: 160, fontSize: 18, letterSpacing: 2, fontFamily: F.semi },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
});
