import { canAdd, checkCombo, RANKS, SUITS, type Card, type Combination, type Move } from "@rami/rules";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View as RNView } from "react-native";
import type { View } from "./game";
import { GREEN } from "./ui";

type Props = { view: View; receivedAt: number; notice: string; dropped: boolean; onMove: (m: Move) => void; onLeave: () => void };

const SUIT_SIGN = { H: "♥", D: "♦", S: "♠", C: "♣" } as const;
const sortKey = (c: Card) => (c.suit ? SUITS.indexOf(c.suit) * 20 + RANKS.indexOf(c.rank as (typeof RANKS)[number]) : 99);

function CardFace({ card, small, selected, onPress }: { card: Card; small?: boolean; selected?: boolean; onPress?: () => void }) {
  const red = card.suit === "H" || card.suit === "D";
  const label = card.rank === "JOKER" ? "★" : `${card.rank}${SUIT_SIGN[card.suit!]}`;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[small ? styles.cardSmall : styles.card, selected && styles.selected]}>
      <Text style={[small ? styles.cardTextSmall : styles.cardText, { color: card.rank === "JOKER" ? "#7a3cc2" : red ? "#c0262d" : "#111" }]}>{label}</Text>
    </Pressable>
  );
}

/** F6, section 7: partner on top, opponents at the sides, you at the bottom. Combinations sit in front of their owner's seat. */
export function Table({ view, receivedAt, notice, dropped, onMove, onLeave }: Props) {
  const t = view.table!;
  const n = view.playerCount;
  const me = view.you;
  const myTurn = t.activeSeat === me && view.status === "playing";

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const secondsLeft = Math.max(0, Math.ceil((t.turnMsLeft - (now - receivedAt)) / 1000));

  // Hand order is local: Sort rearranges it, new cards go on the right.
  const [order, setOrder] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[][]>([]);
  const byId = new Map(view.hand.map((c) => [c.id, c]));
  const hand = [...order.filter((id) => byId.has(id)), ...view.hand.filter((c) => !order.includes(c.id)).map((c) => c.id)].map((id) => byId.get(id)!);
  const live = (ids: string[]) => ids.filter((id) => byId.has(id));
  const sel = live(selected);
  const staged = groups.map(live).filter((g) => g.length > 0);
  const inGroup = new Set(staged.flat());

  const cardsOf = (ids: string[]) => ids.map((id) => byId.get(id)!);
  /** Tap order first (a joker sits where it was tapped), else the order in hand. */
  const asCombo = (ids: string[]) => (checkCombo(cardsOf(ids)) ? ids : hand.map((c) => c.id).filter((id) => ids.includes(id)));
  const clear = () => setSelected([]);

  const tapCard = (id: string) => {
    if (inGroup.has(id)) return setGroups(staged.filter((g) => !g.includes(id))); // tap a grouped card to ungroup it
    setSelected(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  };

  const sort = () => setOrder([...view.hand].sort((a, b) => sortKey(a) - sortKey(b)).map((c) => c.id));
  const group = () => (setGroups([...staged, asCombo(sel)]), clear());
  const talaj = () => {
    const combos = sel.length > 0 ? [...staged, asCombo(sel)] : staged;
    onMove({ kind: "layDown", combos });
    setGroups([]);
    clear();
  };
  const discard = () => (onMove({ kind: "discard", cardId: sel[0]! }), clear());

  /** Tap a card, then a combination: add it, or swap it for a Tria's joker (R-19, R-22). */
  const tapCombo = (combo: Combination) => {
    if (!myTurn || sel.length === 0) return;
    const cards = cardsOf(sel);
    const isSwap = sel.length === 1 && combo.type === "TRIA" && combo.cards.some((c) => c.rank === "JOKER") && !canAdd(combo, cards, "end");
    if (isSwap) onMove({ kind: "swapJoker", comboId: combo.id, cardId: sel[0]! });
    else onMove({ kind: "add", comboId: combo.id, cardIds: sel, side: canAdd(combo, cards, "end") || !canAdd(combo, cards, "start") ? "end" : "start" });
    clear();
  };

  const drawPhase = myTurn && t.phase === "draw";
  const top = t.discardPile.at(-1);
  const unitTotal = (seat: number) => view.totals[view.companion ? seat % 2 : seat] ?? 0;

  const seatAt = (rel: number) => (me + rel) % n;
  // Seats count to the left (R-04), so the next player sits on your left.
  const place = { left: n >= 3 ? seatAt(1) : null, top: n === 2 ? seatAt(1) : n === 4 ? seatAt(2) : null, right: n === 3 ? seatAt(2) : n === 4 ? seatAt(3) : null };

  const seatBox = (seat: number) => {
    const info = view.seats[seat];
    const p = t.players[seat]!;
    const active = t.activeSeat === seat && view.status === "playing";
    return (
      <RNView style={[styles.seat, active && styles.activeSeat, p.forfeited && styles.out]}>
        {info?.avatar ? <Image source={{ uri: info.avatar }} style={styles.avatar} /> : <RNView style={styles.avatar} />}
        <RNView>
          <Text style={styles.seatName} numberOfLines={1}>{seat === me ? "You" : info?.name || `Player ${seat + 1}`}</Text>
          <Text style={styles.seatInfo}>
            {p.forfeited ? "Left" : `${p.handCount} cards · ${unitTotal(seat)} pts`}
            {p.opened ? " · opened" : ""}
            {info && !info.connected ? " · offline" : ""}
          </Text>
        </RNView>
        {active && <Text style={styles.timer}>{secondsLeft}</Text>}
      </RNView>
    );
  };

  const combos = (seat: number, vertical = false) => (
    <RNView style={[styles.combos, vertical && styles.combosVertical]}>
      {t.combinations.filter((c) => c.ownerSeat === seat).map((combo) => (
        <Pressable key={combo.id} onPress={() => tapCombo(combo)} style={styles.combo}>
          {combo.cards.map((c) => <CardFace key={c.id} card={c} small />)}
        </Pressable>
      ))}
    </RNView>
  );

  const side = (seat: number | null) =>
    seat === null ? <RNView style={styles.side} /> : (
      <RNView style={styles.side}>
        {seatBox(seat)}
        {combos(seat, true)}
      </RNView>
    );

  const button = (label: string, onPress: () => void, enabled: boolean) => (
    <Pressable style={[styles.action, !enabled && styles.disabled]} disabled={!enabled} onPress={onPress}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );

  const winnerName =
    view.winner === null ? "" : view.companion ? `Team ${view.winner + 1}${view.winner === me % 2 ? " (you)" : ""}` : view.winner === me ? "You" : view.seats[view.winner]?.name || `Player ${view.winner + 1}`;

  return (
    <RNView style={styles.table}>
      <RNView style={styles.topRow}>
        {place.top !== null && (
          <>
            {seatBox(place.top)}
            {combos(place.top)}
          </>
        )}
      </RNView>

      <RNView style={styles.middle}>
        {side(place.left)}
        <RNView style={styles.center}>
          <Text style={styles.chip}>Next opening: more than {t.openingThreshold - 1}</Text>
          <RNView style={styles.piles}>
            <Pressable style={[styles.card, styles.back, drawPhase && styles.glow]} disabled={!drawPhase} onPress={() => onMove({ kind: "draw" })}>
              <Text style={styles.backText}>{t.drawCount}</Text>
            </Pressable>
            {t.firstDiscard && (
              <RNView style={styles.pileLabel}>
                <CardFace card={t.firstDiscard} onPress={drawPhase ? () => onMove({ kind: "takeFirstDiscard" }) : undefined} />
                <Text style={styles.seatInfo}>First discard</Text>
              </RNView>
            )}
            {top ? <CardFace card={top} onPress={drawPhase ? () => onMove({ kind: "takeDiscard" }) : undefined} /> : <RNView style={[styles.card, styles.empty]} />}
          </RNView>
          {!!notice && <Text style={styles.notice}>{notice}</Text>}
          {dropped && <Text style={styles.notice}>Reconnecting…</Text>}
        </RNView>
        {side(place.right)}
      </RNView>

      <RNView style={styles.bottom}>
        <RNView style={styles.mine}>
          <RNView style={styles.myRow}>
            {seatBox(me)}
            {combos(me)}
            {staged.map((g, i) => {
              const c = checkCombo(cardsOf(g));
              return <Text key={i} style={styles.group}>{c ? `${c.type === "TRIA" ? "Tria" : "Serie"} ${c.points}` : "Not a combination"}</Text>;
            })}
          </RNView>
          <RNView style={styles.hand}>
            {hand.map((c) => (
              <RNView key={c.id} style={[styles.handSlot, inGroup.has(c.id) && styles.grouped]}>
                <CardFace card={c} selected={sel.includes(c.id)} onPress={() => tapCard(c.id)} />
              </RNView>
            ))}
          </RNView>
        </RNView>
        <RNView style={styles.actions}>
          {button("Sort", sort, true)}
          {button("Group", group, sel.length >= 3)}
          {button("Talaj", talaj, myTurn && t.phase === "play" && (sel.length >= 3 || staged.length > 0))}
          {button("Discard", discard, myTurn && t.phase === "play" && sel.length === 1)}
        </RNView>
      </RNView>

      {view.status === "finished" && (
        <RNView style={styles.overlay}>
          <Text style={styles.overlayText}>{winnerName} won</Text>
          {button("Home", onLeave, true)}
        </RNView>
      )}
    </RNView>
  );
}

const styles = StyleSheet.create({
  table: { flex: 1, backgroundColor: GREEN, padding: 6 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44 },
  middle: { flex: 1, flexDirection: "row" },
  side: { width: "26%", alignItems: "center", gap: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  piles: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  pileLabel: { alignItems: "center" },
  chip: { color: "white", backgroundColor: "#00000040", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, fontSize: 12 },
  notice: { color: "#fff3b0", fontSize: 14, fontWeight: "600" },
  bottom: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  mine: { flex: 1, gap: 4 },
  myRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  hand: { flexDirection: "row" },
  handSlot: { flex: 1, maxWidth: 46, alignItems: "center" },
  grouped: { opacity: 0.45 },
  actions: { gap: 4 },
  action: { backgroundColor: "white", borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, alignItems: "center", minWidth: 72 },
  actionText: { color: GREEN, fontWeight: "700", fontSize: 13 },
  disabled: { opacity: 0.35 },
  seat: { flexDirection: "row", alignItems: "center", gap: 6, padding: 4, borderRadius: 8, borderWidth: 2, borderColor: "transparent" },
  activeSeat: { borderColor: "#ffd34d", backgroundColor: "#ffffff1a" },
  out: { opacity: 0.4 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#ffffff33" },
  seatName: { color: "white", fontWeight: "700", fontSize: 13, maxWidth: 110 },
  seatInfo: { color: "#d8eadf", fontSize: 11 },
  timer: { color: "#ffd34d", fontWeight: "800", fontSize: 18, minWidth: 22, textAlign: "center" },
  combos: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
  combosVertical: { flexDirection: "column", alignItems: "center" },
  combo: { flexDirection: "row", padding: 2, borderRadius: 4, backgroundColor: "#00000026" },
  group: { color: "#fff3b0", fontSize: 12, borderWidth: 1, borderColor: "#fff3b0", borderStyle: "dashed", borderRadius: 4, paddingHorizontal: 4 },
  card: { width: 42, height: 60, borderRadius: 5, backgroundColor: "white", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#999" },
  cardSmall: { width: 22, height: 30, borderRadius: 3, backgroundColor: "white", alignItems: "center", justifyContent: "center", marginRight: -4, borderWidth: 1, borderColor: "#999" },
  cardText: { fontSize: 15, fontWeight: "700" },
  cardTextSmall: { fontSize: 10, fontWeight: "700" },
  selected: { transform: [{ translateY: -10 }], borderColor: "#ffd34d", borderWidth: 2 },
  back: { backgroundColor: "#7a1f2b" },
  backText: { color: "white", fontWeight: "700" },
  glow: { borderColor: "#ffd34d", borderWidth: 2 },
  empty: { backgroundColor: "transparent", borderStyle: "dashed", borderColor: "#ffffff66" },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: "#000000aa", alignItems: "center", justifyContent: "center", gap: 12 },
  overlayText: { color: "white", fontSize: 28, fontWeight: "800" },
});
