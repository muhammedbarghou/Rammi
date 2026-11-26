import { canAdd, checkCombo, RANKS, SUITS, type Card, type Combination, type Move } from "@rami/rules";
import { type ComponentRef, type ReactNode, useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View as RNView } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { FadeInDown, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withSpring, withTiming, ZoomIn } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { CARD_IMAGES } from "./cardImages";
import type { View } from "./game";
import { GREEN } from "./ui";

type Props = { view: View; receivedAt: number; notice: string; dropped: boolean; onMove: (m: Move) => void; onLeave: () => void };

const sortKey = (c: Card) => (c.suit ? SUITS.indexOf(c.suit) * 20 + RANKS.indexOf(c.rank as (typeof RANKS)[number]) : 99);

/** The PNGs are 64x64 with the card at x 11..53, y 2..62, so the frame crops to that 42x60 face. Card ids are `${deck}${rank}${suit}`. */
function CardFace({ card, small, selected, onPress, children }: { card: Card | null; small?: boolean; selected?: boolean; onPress?: () => void; children?: ReactNode }) {
  const s = small ? 0.55 : 1;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.card, { width: 42 * s, height: 60 * s }, small && styles.cardSmall, selected && styles.selected]}>
      <Image source={CARD_IMAGES[card ? card.id.slice(1) : "back"]} style={{ width: 64 * s, height: 64 * s, marginLeft: -11 * s, marginTop: -2 * s }} />
      {children}
    </Pressable>
  );
}

/** A hand card you can tap to select or drag onto a combination or the discard pile. `onDrop` says whether a move was sent. */
function HandCard({ card, selected, grouped, onPress, onDrop }: { card: Card; selected: boolean; grouped: boolean; onPress: () => void; onDrop: (id: string, x: number, y: number) => Promise<boolean> }) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const lift = useSharedValue(0);
  const back = () => {
    x.value = withSpring(0);
    y.value = withSpring(0);
    lift.value = withTiming(0);
  };
  const drop = async (ax: number, ay: number) => {
    if (!(await onDrop(card.id, ax, ay))) return back();
    // Sent: the card waits on the target and leaves with the next server view. If the server rejects the move, it flies home.
    lift.value = withTiming(0);
    setTimeout(back, 1500);
  };
  const pan = usePanGesture({
    minDistance: 8,
    onActivate: () => {
      lift.value = withTiming(1, { duration: 120 });
    },
    onUpdate: (e) => {
      x.value = e.translationX;
      y.value = e.translationY;
    },
    onDeactivate: (e) => {
      if (e.canceled) scheduleOnRN(back);
      else scheduleOnRN(drop, e.absoluteX, e.absoluteY);
    },
  });
  const moving = useAnimatedStyle(() => ({
    zIndex: lift.value > 0 ? 10 : 0,
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: 1 + 0.15 * lift.value }],
  }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View entering={FadeInDown} exiting={FadeOut} layout={LinearTransition} style={[styles.handSlot, grouped && styles.grouped, moving]}>
        <CardFace card={card} selected={selected} onPress={onPress} />
      </Animated.View>
    </GestureDetector>
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

  /** Add cards to a combination, or swap one for a Tria's joker (R-19, R-22). */
  const playOn = (combo: Combination, ids: string[]) => {
    const cards = cardsOf(ids);
    const isSwap = ids.length === 1 && combo.type === "TRIA" && combo.cards.some((c) => c.rank === "JOKER") && !canAdd(combo, cards, "end");
    if (isSwap) onMove({ kind: "swapJoker", comboId: combo.id, cardId: ids[0]! });
    else onMove({ kind: "add", comboId: combo.id, cardIds: ids, side: canAdd(combo, cards, "end") || !canAdd(combo, cards, "start") ? "end" : "start" });
    clear();
  };
  const tapCombo = (combo: Combination) => myTurn && sel.length > 0 && playOn(combo, sel);

  // Drop targets: each combination by id, plus "discard". Measured at drop time because the table reflows as combinations grow.
  const zones = useRef(new Map<string, ComponentRef<typeof RNView>>());
  const zone = (key: string) => (el: ComponentRef<typeof RNView> | null) => void (el ? zones.current.set(key, el) : zones.current.delete(key));
  const hit = async (ax: number, ay: number) => {
    const keys = await Promise.all(
      [...zones.current].map(([key, el]) => new Promise<string | null>((res) => el.measureInWindow((x, y, w, h) => res(ax >= x && ax <= x + w && ay >= y && ay <= y + h ? key : null)))),
    );
    return keys.find((k) => k !== null) ?? null;
  };
  /** Dragging a selected card plays the whole selection; dragging any other card plays just that card. The server still validates. */
  const dropCard = async (id: string, ax: number, ay: number) => {
    if (!myTurn || t.phase !== "play") return false;
    const ids = sel.includes(id) ? sel : [id];
    const key = await hit(ax, ay);
    if (key === "discard") {
      if (ids.length !== 1) return false;
      onMove({ kind: "discard", cardId: ids[0]! });
      clear();
      return true;
    }
    const combo = t.combinations.find((c) => c.id === key);
    if (!combo) return false;
    playOn(combo, ids);
    return true;
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
        <Pressable key={combo.id} ref={zone(combo.id)} onPress={() => tapCombo(combo)} style={styles.combo}>
          {combo.cards.map((c) => (
            <Animated.View key={c.id} entering={ZoomIn.springify()}>
              <CardFace card={c} small />
            </Animated.View>
          ))}
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
            <RNView style={drawPhase && styles.glow}>
              <CardFace card={null} onPress={drawPhase ? () => onMove({ kind: "draw" }) : undefined}>
                <Text style={styles.backText}>{t.drawCount}</Text>
              </CardFace>
            </RNView>
            {t.firstDiscard && (
              <RNView style={styles.pileLabel}>
                <CardFace card={t.firstDiscard} onPress={drawPhase ? () => onMove({ kind: "takeFirstDiscard" }) : undefined} />
                <Text style={styles.seatInfo}>First discard</Text>
              </RNView>
            )}
            <RNView ref={zone("discard")} collapsable={false}>
              {top ? (
                <Animated.View key={top.id} entering={ZoomIn.springify()}>
                  <CardFace card={top} onPress={drawPhase ? () => onMove({ kind: "takeDiscard" }) : undefined} />
                </Animated.View>
              ) : (
                <RNView style={[styles.card, styles.empty]} />
              )}
            </RNView>
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
              <HandCard key={c.id} card={c} selected={sel.includes(c.id)} grouped={inGroup.has(c.id)} onPress={() => tapCard(c.id)} onDrop={dropCard} />
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
  card: { width: 42, height: 60, borderRadius: 4, overflow: "hidden" },
  cardSmall: { marginRight: -4 },
  selected: { transform: [{ translateY: -10 }], outlineColor: "#ffd34d", outlineWidth: 2 },
  backText: { position: "absolute", alignSelf: "center", top: 20, color: "white", fontWeight: "800", textShadowColor: "black", textShadowRadius: 3 },
  glow: { borderColor: "#ffd34d", borderWidth: 2, borderRadius: 6 },
  empty: { backgroundColor: "transparent", borderWidth: 1, borderStyle: "dashed", borderColor: "#ffffff66" },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: "#000000aa", alignItems: "center", justifyContent: "center", gap: 12 },
  overlayText: { color: "white", fontSize: 28, fontWeight: "800" },
});
