import { TURN_SECONDS } from "@rami/rules";
import { WifiOff } from "lucide-react-native";
import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { CARD_IMAGES } from "../cardImages";
import { C, F } from "../ui";

const RING = 42;
const STROKE = 3;
const R = (RING - STROKE) / 2;
const LEN = 2 * Math.PI * R;

/** Amber when time runs low, red for the last seconds (F4). */
export const timerColor = (s: number) => (s > 7 ? C.gold : s > 3 ? C.amber : C.red);

/** Badge with a letter, so teams never rely on colour alone. */
export function TeamBadge({ team }: { team: number }) {
  return (
    <View style={[styles.badge, { backgroundColor: team === 0 ? C.teamA : C.teamB }]}>
      <Text style={styles.badgeText}>{team === 0 ? "A" : "B"}</Text>
    </View>
  );
}

type Props = {
  name: string;
  avatar?: string;
  handCount: number;
  total: number;
  opened: boolean;
  connected: boolean;
  forfeited: boolean;
  active: boolean;
  msLeft: number;
  team: number | null;
  isMe: boolean;
};

/** F4, section 7: the active seat gets a gold ring that runs down with the 15-second turn. */
export function Seat({ name, avatar, handCount, total, opened, connected, forfeited, active, msLeft, team, isMe }: Props) {
  const secs = Math.ceil(msLeft / 1000);
  const color = timerColor(secs);
  const progress = Math.max(0, Math.min(1, msLeft / (TURN_SECONDS * 1000)));
  return (
    <View style={[styles.seat, active && styles.activeSeat, forfeited && styles.out]} accessibilityLabel={`${name}, ${handCount} cards, ${total} points${active ? ", playing" : ""}`}>
      <View style={styles.ring}>
        <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
          <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={C.line} strokeWidth={STROKE} fill="none" />
          {active && (
            <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={color} strokeWidth={STROKE} fill="none" strokeLinecap="round" strokeDasharray={LEN} strokeDashoffset={LEN * (1 - progress)} rotation={-90} origin={`${RING / 2}, ${RING / 2}`} />
          )}
        </Svg>
        {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : <View style={styles.avatar} />}
        {team !== null && (
          <View style={styles.badgeSpot}>
            <TeamBadge team={team} />
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, active && { color: C.gold }]} numberOfLines={1}>{name}</Text>
        <View style={styles.line}>
          {!isMe && <Image source={CARD_IMAGES.back} style={styles.miniBack} />}
          <Text style={styles.meta}>
            {forfeited ? "Left" : `${handCount} · ${total} pts`}
            {opened ? " · opened" : ""}
          </Text>
          {!connected && <WifiOff size={12} color={C.red} accessibilityLabel="Offline" />}
        </View>
        {active && <Text style={[styles.playing, { color }]}>Playing · {secs}s</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  seat: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 3, paddingHorizontal: 6, borderRadius: 12, backgroundColor: "#00000033", borderWidth: 1, borderColor: C.line },
  activeSeat: { borderColor: C.gold + "80" },
  out: { opacity: 0.45 },
  ring: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  avatar: { width: RING - 10, height: RING - 10, borderRadius: (RING - 10) / 2, backgroundColor: "#ffffff22" },
  badgeSpot: { position: "absolute", right: -2, bottom: -2 },
  badge: { width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.bg },
  badgeText: { color: C.surface, fontSize: 9, fontFamily: F.bold },
  info: { gap: 1 },
  name: { color: C.ivory, fontSize: 13, fontFamily: F.semi, maxWidth: 110 },
  line: { flexDirection: "row", alignItems: "center", gap: 4 },
  miniBack: { width: 16, height: 16, marginHorizontal: -3 },
  meta: { color: C.muted, fontSize: 11, fontFamily: F.regular, fontVariant: ["tabular-nums"] },
  playing: { fontSize: 11, fontFamily: F.semi, fontVariant: ["tabular-nums"] },
});
