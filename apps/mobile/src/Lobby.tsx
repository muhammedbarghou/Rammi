import { Image, Pressable, StyleSheet, Text, View as RNView } from "react-native";
import type { View } from "./game";
import { ui } from "./ui";

/** F2: shown until the seats are full. seats[0] is the creator. */
export function Lobby({ view, onLeave }: { view: View; onLeave: () => void }) {
  const missing = view.playerCount - view.seats.length;
  return (
    <RNView style={ui.screen}>
      <Text style={ui.text}>Party code</Text>
      <Text selectable style={styles.code}>{view.code}</Text>
      <Text style={ui.text}>
        {view.playerCount} players{view.companion ? ", companion mode" : ""}, target {view.target}
      </Text>
      <RNView style={ui.row}>
        {view.seats.map((s, i) => (
          <RNView key={s.userId} style={styles.seat}>
            {s.avatar ? <Image source={{ uri: s.avatar }} style={styles.avatar} /> : <RNView style={styles.avatar} />}
            <Text style={ui.text}>{s.name || "Player"}{i === 0 ? " (creator)" : ""}</Text>
          </RNView>
        ))}
      </RNView>
      <Text style={ui.text}>Waiting for {missing} more {missing === 1 ? "player" : "players"}…</Text>
      <Pressable style={ui.button} onPress={onLeave}>
        <Text style={ui.buttonText}>Leave</Text>
      </Pressable>
    </RNView>
  );
}

const styles = StyleSheet.create({
  code: { color: "white", fontSize: 40, fontWeight: "800", letterSpacing: 6 },
  seat: { alignItems: "center", gap: 4, marginHorizontal: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#ffffff33" },
});
