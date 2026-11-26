import { Crown, LogOut, Play, Trophy, X } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { C, F } from "../ui";

/** A player, or a team in companion mode: one column of scores. */
export type Unit = { label: string; members: string; mine: boolean };
export type RoundRow = { winner: number; scores: number[] };

export function Button({ label, icon, onPress, kind = "secondary", disabled }: { label: string; icon?: ReactNode; onPress: () => void; kind?: "primary" | "secondary"; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.button, kind === "primary" ? styles.primary : styles.secondary, disabled && styles.disabled]}
    >
      {icon}
      <Text style={[styles.buttonText, kind === "primary" && !disabled && { color: C.surface }, disabled && { color: C.muted }]}>{label}</Text>
    </Pressable>
  );
}

function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} supportedOrientations={["landscape"]}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHead}>
            <Text style={styles.heading}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={C.muted} />
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Round history and totals per player or team, against the target score (R-27 to R-29). */
export function Scoreboard({ visible, onClose, units, rounds, totals, target }: { visible: boolean; onClose: () => void; units: Unit[]; rounds: RoundRow[]; totals: number[]; target: number }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={`Scoreboard · target ${target}`}>
      <ScrollView style={{ maxHeight: 220 }}>
        <View style={styles.row}>
          <Text style={[styles.cell, styles.roundCell, styles.headCell]}>Round</Text>
          {units.map((u, i) => (
            <View key={i} style={[styles.cell, u.mine && styles.mine]}>
              <Text style={styles.headCell} numberOfLines={1}>{u.label}</Text>
              {!!u.members && <Text style={styles.sub} numberOfLines={1}>{u.members}</Text>}
            </View>
          ))}
        </View>
        {rounds.map((r, n) => (
          <View key={n} style={styles.row}>
            <Text style={[styles.cell, styles.roundCell, styles.num]}>{n + 1}</Text>
            {r.scores.map((s, i) => (
              <View key={i} style={[styles.cell, styles.scoreCell, units[i]?.mine && styles.mine]}>
                {s === 0 && <Crown size={12} color={C.gold} accessibilityLabel="Round winner" />}
                <Text style={styles.num}>{s}</Text>
              </View>
            ))}
          </View>
        ))}
        {rounds.length === 0 && <Text style={styles.sub}>No round finished yet.</Text>}
      </ScrollView>
      <View style={[styles.row, styles.totalRow]}>
        <Text style={[styles.cell, styles.roundCell, styles.headCell]}>Total</Text>
        {totals.map((t, i) => (
          <Text key={i} style={[styles.cell, styles.total, units[i]?.mine && styles.mine, t >= target && { color: C.red }]}>{t}</Text>
        ))}
      </View>
    </Sheet>
  );
}

/** In-game menu. Opening it does not pause the match; leaving asks first. */
export function GameMenu({ visible, onClose, code, onLeave }: { visible: boolean; onClose: () => void; code: string; onLeave: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const close = () => (setConfirm(false), onClose());
  return (
    <Sheet visible={visible} onClose={close} title={confirm ? "Leave the game?" : `Party ${code}`}>
      {confirm ? (
        <>
          <Text style={styles.body}>The game keeps going without you.</Text>
          <View style={styles.actions}>
            <Button label="Stay" onPress={() => setConfirm(false)} />
            <Button label="Leave" kind="primary" icon={<LogOut size={16} color={C.surface} />} onPress={onLeave} />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.body}>The game keeps running while this menu is open.</Text>
          <View style={styles.actions}>
            <Button label="Resume" kind="primary" icon={<Play size={16} color={C.surface} />} onPress={close} />
            <Button label="Leave game" icon={<LogOut size={16} color={C.ivory} />} onPress={() => setConfirm(true)} />
          </View>
        </>
      )}
    </Sheet>
  );
}

/** Shown for a few seconds after a round. The next round is already dealt, so it never blocks the hand. */
export function RoundResult({ round, number, units, totals, winnerName, onClose, onScores }: { round: RoundRow; number: number; units: Unit[]; totals: number[]; winnerName: string; onClose: () => void; onScores: () => void }) {
  return (
    <Animated.View entering={ZoomIn.duration(200)} style={styles.roundCard}>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close round result">
        <Text style={styles.heading}>{winnerName} won round {number}</Text>
        {units.map((u, i) => (
          <View key={i} style={[styles.resultRow, u.mine && styles.mine]}>
            <Text style={styles.body} numberOfLines={1}>{u.label}</Text>
            <Text style={[styles.num, { color: round.scores[i] ? C.ivory : C.gold }]}>+{round.scores[i]}</Text>
            <Text style={[styles.num, styles.muted]}>{totals[i]}</Text>
          </View>
        ))}
      </Pressable>
      <View style={styles.actions}>
        <Button label="Scoreboard" onPress={onScores} />
        <Button label="Continue" kind="primary" onPress={onClose} />
      </View>
    </Animated.View>
  );
}

/** R-29: the last player or team left wins. Lowest totals rank first. */
export function FinalResult({ winner, units, totals, rounds, onHome }: { winner: number; units: Unit[]; totals: number[]; rounds: number; onHome: () => void }) {
  const ranking = units.map((u, i) => ({ u, i, total: totals[i] ?? 0 })).sort((a, b) => (a.i === winner ? -1 : b.i === winner ? 1 : a.total - b.total));
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.overlay}>
      <Trophy size={44} color={C.gold} />
      <Text style={styles.title}>{units[winner]?.label} won</Text>
      <Text style={styles.sub}>{rounds} {rounds === 1 ? "round" : "rounds"} played</Text>
      <View style={{ gap: 4, minWidth: 260 }}>
        {ranking.map(({ u, i, total }, place) => (
          <View key={i} style={[styles.resultRow, u.mine && styles.mine]}>
            <Text style={[styles.num, styles.muted]}>{place + 1}</Text>
            <Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>{u.label}</Text>
            <Text style={styles.num}>{total}</Text>
          </View>
        ))}
      </View>
      <Button label="Home" kind="primary" onPress={onHome} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 44, minWidth: 88, paddingHorizontal: 14, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  primary: { backgroundColor: C.gold },
  secondary: { backgroundColor: C.table, borderWidth: 1, borderColor: C.line },
  disabled: { backgroundColor: "#ffffff10", borderColor: "transparent" },
  buttonText: { color: C.ivory, fontSize: 14, fontFamily: F.semi },
  backdrop: { flex: 1, backgroundColor: "#000000a0", alignItems: "center", justifyContent: "center" },
  sheet: { backgroundColor: C.surface, borderRadius: 16, padding: 16, gap: 10, minWidth: 320, maxWidth: "80%", borderWidth: 1, borderColor: C.line },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  heading: { color: C.ivory, fontSize: 18, fontFamily: F.semi },
  title: { color: C.ivory, fontSize: 28, fontFamily: F.bold },
  body: { color: C.ivory, fontSize: 14, fontFamily: F.regular, flexShrink: 1 },
  sub: { color: C.muted, fontSize: 11, fontFamily: F.regular },
  muted: { color: C.muted },
  actions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line },
  totalRow: { borderBottomWidth: 0 },
  cell: { flex: 1, paddingVertical: 5, paddingHorizontal: 6, borderRadius: 6, color: C.ivory },
  roundCell: { flex: 0, width: 56 },
  scoreCell: { flexDirection: "row", alignItems: "center", gap: 4 },
  headCell: { color: C.ivory, fontSize: 12, fontFamily: F.semi },
  num: { color: C.ivory, fontSize: 14, fontFamily: F.semi, fontVariant: ["tabular-nums"] },
  total: { fontSize: 20, fontFamily: F.bold, fontVariant: ["tabular-nums"] },
  mine: { backgroundColor: "#ffffff12" },
  roundCard: { position: "absolute", alignSelf: "center", top: "22%", backgroundColor: C.surface, borderRadius: 16, padding: 14, gap: 8, minWidth: 280, borderWidth: 1, borderColor: C.gold + "60" },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, justifyContent: "space-between" },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: "#0B241Bf0", alignItems: "center", justifyContent: "center", gap: 10 },
});
