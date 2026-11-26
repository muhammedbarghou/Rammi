import { StyleSheet } from "react-native";

export const GREEN = "#0b5d3b";

/** Shared styles for the screens outside the table. */
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: GREEN, alignItems: "center", justifyContent: "center", gap: 12, padding: 16 },
  title: { color: "white", fontSize: 26, fontWeight: "700" },
  text: { color: "white", fontSize: 16 },
  button: { backgroundColor: "white", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, minWidth: 120, alignItems: "center" },
  buttonText: { color: GREEN, fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.4 },
  error: { color: "#ffd2d2", fontSize: 14 },
  input: { backgroundColor: "white", borderRadius: 8, paddingHorizontal: 12, height: 44, minWidth: 160, fontSize: 18, letterSpacing: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
});
