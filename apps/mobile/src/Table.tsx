import { canAdd, checkCombo, RANKS, SUITS, type Card, type Combination, type Move } from "@rami/rules";
import { ArrowDownToLine, ArrowDownUp, Layers, ListOrdered, Loader, Menu, Wifi, WifiOff, Check } from "lucide-react-native";
import { type ComponentRef, type ReactNode, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View as RNView } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import type { View } from "./game";
import { CardFace, CardStack, HandCard } from "./table/Card";
import { Seat } from "./table/Seat";
import { Button, FinalResult, GameMenu, RoundResult, Scoreboard, type Unit } from "./table/Sheets";
import { C, F } from "./ui";

type Props = { view: View; receivedAt: number; notice: string; dropped: boolean; onMove: (m: Move) => void; onLeave: () => void };

const rankIndex = (c: Card) => (c.suit ? RANKS.indexOf(c.rank as (typeof RANKS)[number]) : 99);
const bySuit = (c: Card) => (c.suit ? SUITS.indexOf(c.suit) * 20 + rankIndex(c) : 999);
const byRank = (c: Card) => (c.suit ? rankIndex(c) * 4 + SUITS.indexOf(c.suit) : 999);

/** Dark felt, lighter toward the centre. */
function Felt() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="felt" cx="50%" cy="50%" r="70%">
          <Stop offset="0" stopColor={C.felt} />
          <Stop offset="0.6" stopColor={C.table} />
          <Stop offset="1" stopColor={C.bg} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#felt)" />
    </Svg>
  );
}

function IconButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label} style={styles.iconButton}>
      {children}
    </Pressable>
  );
}

/** F6, section 7: partner on top, opponents at the sides, you at the bottom. Combinations sit in front of their owner's seat. */
export function Table({ view, receivedAt, notice, dropped, onMove, onLeave }: Props) {
  const t = view.table!;
  const n = view.playerCount;
  const me = view.you;
  const playing = view.status === "playing";
  const myTurn = t.activeSeat === me && playing && !dropped;

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const msLeft = Math.max(0, t.turnMsLeft - (now - receivedAt));

  // Hand order is local: Sort rearranges it, new cards go on the right.
  const [order, setOrder] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[][]>([]);
  const [sortOpen, setSortOpen] = useState(false);
  const [sheet, setSheet] = useState<"menu" | "scores" | null>(null);
  const byId = new Map(view.hand.map((c) => [c.id, c]));
  const hand = [...order.filter((id) => byId.has(id)), ...view.hand.filter((c) => !order.includes(c.id)).map((c) => c.id)].map((id) => byId.get(id)!);
  const live = (ids: string[]) => ids.filter((id) => byId.has(id));
  const sel = live(selected);
  const staged = groups.map(live).filter((g) => g.length > 0);
  const inGroup = new Set(staged.flat());

  // A single card that just arrived (a draw) is outlined for a moment. A new deal changes many cards and is not.
  const prevHand = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  useEffect(() => {
    const prev = prevHand.current;
    prevHand.current = new Set(view.hand.map((c) => c.id));
    const added = prev ? view.hand.filter((c) => !prev.has(c.id)) : [];
    if (added.length !== 1) return;
    setFresh(added[0]!.id);
    const id = setTimeout(() => setFresh(null), 1200);
    return () => clearTimeout(id);
  }, [view.hand]);

  // Round results show once per finished round; a reconnect starts from the current count, so nothing replays.
  const [seenRounds, setSeenRounds] = useState(view.rounds.length);
  const lastRound = playing && view.rounds.length > seenRounds ? view.rounds.at(-1)! : null;
  useEffect(() => {
    if (!lastRound) return;
    const id = setTimeout(() => setSeenRounds(view.rounds.length), 6000);
    return () => clearTimeout(id);
  }, [lastRound, view.rounds.length]);

  const cardsOf = (ids: string[]) => ids.map((id) => byId.get(id)!);
  /** Tap order first (a joker sits where it was tapped), else the order in hand. */
  const asCombo = (ids: string[]) => (checkCombo(cardsOf(ids)) ? ids : hand.map((c) => c.id).filter((id) => ids.includes(id)));
  const clear = () => setSelected([]);

  const tapCard = (id: string) => {
    if (inGroup.has(id)) return setGroups(staged.filter((g) => !g.includes(id))); // tap a grouped card to ungroup it
    setSelected(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  };

  const sort = (key: (c: Card) => number) => (setOrder([...view.hand].sort((a, b) => key(a) - key(b)).map((c) => c.id)), setSortOpen(false));
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
  const playPhase = myTurn && t.phase === "play";
  const tapCombo = (combo: Combination) => playPhase && sel.length > 0 && playOn(combo, sel);
  /** Gold outline on combinations the selection can extend (R-19). The server still decides. */
  const extendable = (combo: Combination) => playPhase && !!t.players[me]?.opened && sel.length > 0 && (canAdd(combo, cardsOf(sel), "end") || canAdd(combo, cardsOf(sel), "start"));

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
    if (!playPhase) return false;
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
  const unitOf = (seat: number) => (view.companion ? seat % 2 : seat);
  const nameOf = (seat: number) => (seat === me ? "You" : view.seats[seat]?.name || `Player ${seat + 1}`);
  const units: Unit[] = view.companion
    ? [0, 1].map((team) => ({ label: `Team ${team === 0 ? "A" : "B"}`, members: [team, team + 2].map(nameOf).join(" & "), mine: me % 2 === team }))
    : view.seats.map((_, seat) => ({ label: nameOf(seat), members: "", mine: seat === me }));

  const seatAt = (rel: number) => (me + rel) % n;
  // Seats count to the left (R-04), so the next player sits on your left.
  const place = { left: n >= 3 ? seatAt(1) : null, top: n === 2 ? seatAt(1) : n === 4 ? seatAt(2) : null, right: n === 3 ? seatAt(2) : n === 4 ? seatAt(3) : null };

  const seatBox = (seat: number) => {
    const info = view.seats[seat];
    const p = t.players[seat]!;
    const active = t.activeSeat === seat && playing;
    return (
      <Seat
        name={nameOf(seat)}
        avatar={info?.avatar || undefined}
        handCount={p.handCount}
        total={view.totals[unitOf(seat)] ?? 0}
        opened={p.opened}
        connected={info?.connected ?? false}
        forfeited={p.forfeited}
        active={active}
        msLeft={active ? msLeft : 0}
        team={view.companion ? seat % 2 : null}
        isMe={seat === me}
      />
    );
  };

  const combos = (seat: number, vertical = false) => (
    <RNView style={[styles.combos, vertical && styles.combosVertical]}>
      {t.combinations.filter((c) => c.ownerSeat === seat).map((combo) => (
        <Pressable
          key={combo.id}
          ref={zone(combo.id)}
          onPress={() => tapCombo(combo)}
          accessibilityLabel={`${combo.type === "TRIA" ? "Tria" : "Serie"} of ${nameOf(seat)}`}
          style={[styles.combo, view.companion && { borderColor: (seat % 2 === 0 ? C.teamA : C.teamB) + "55" }, extendable(combo) && styles.target]}
        >
          {combo.cards.map((c) => (
            <Animated.View key={c.id} entering={ZoomIn.duration(300)} style={styles.comboCard}>
              <CardFace card={c} scale={0.55} />
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

  const status = !playing ? "" : myTurn ? (t.phase === "draw" ? "Your turn · Draw a card" : "Your turn · Talaj, then discard one card") : dropped ? "" : `Waiting for ${nameOf(t.activeSeat)}`;
  const canTalaj = playPhase && (sel.length >= 3 || staged.length > 0);
  const canDiscard = playPhase && sel.length === 1;
  const roundNumber = view.rounds.length + (playing ? 1 : 0);

  return (
    <RNView style={styles.table}>
      <Felt />

      <RNView style={styles.topRow}>
        <IconButton label="Menu" onPress={() => setSheet("menu")}>
          <Menu size={20} color={C.ivory} />
        </IconButton>
        <RNView style={styles.topSeat}>
          {place.top !== null && (
            <>
              {seatBox(place.top)}
              {combos(place.top)}
            </>
          )}
        </RNView>
        <RNView style={styles.corner}>
          <IconButton label="Scoreboard" onPress={() => setSheet("scores")}>
            <ListOrdered size={20} color={C.ivory} />
          </IconButton>
          <RNView accessibilityLabel={dropped ? "Disconnected" : "Connected"} style={styles.conn}>
            {dropped ? <WifiOff size={16} color={C.red} /> : <Wifi size={16} color={C.muted} />}
          </RNView>
        </RNView>
      </RNView>

      <RNView style={styles.middle}>
        {side(place.left)}
        <RNView style={styles.center}>
          <Text style={styles.chip}>
            Round {roundNumber} · {view.companion ? "2 vs 2" : `${n} players`} · Next opening: more than {t.openingThreshold - 1}
          </Text>
          <RNView style={styles.piles}>
            <RNView style={styles.pileLabel}>
              <RNView style={[styles.pile, drawPhase && styles.target]}>
                <CardStack>
                  <CardFace card={null} onPress={drawPhase ? () => onMove({ kind: "draw" }) : undefined}>
                    <Text style={styles.backText}>{t.drawCount}</Text>
                  </CardFace>
                </CardStack>
              </RNView>
              <Text style={styles.pileText}>Draw</Text>
            </RNView>
            {t.firstDiscard && (
              <RNView style={styles.pileLabel}>
                <RNView style={[styles.pile, drawPhase && styles.target]}>
                  <CardFace card={t.firstDiscard} onPress={drawPhase ? () => onMove({ kind: "takeFirstDiscard" }) : undefined} />
                </RNView>
                <Text style={styles.pileText}>First discard</Text>
              </RNView>
            )}
            <RNView style={styles.pileLabel}>
              <RNView ref={zone("discard")} collapsable={false} style={[styles.pile, (drawPhase || canDiscard) && !!top && styles.target]}>
                {top ? (
                  <CardStack layers={t.discardPile.length > 1 ? 1 : 0}>
                    <Animated.View key={top.id} entering={ZoomIn.duration(220)}>
                      <CardFace card={top} onPress={drawPhase ? () => onMove({ kind: "takeDiscard" }) : undefined} />
                    </Animated.View>
                  </CardStack>
                ) : (
                  <RNView style={[styles.empty, canDiscard && { borderColor: C.gold }]} />
                )}
              </RNView>
              <Text style={styles.pileText}>Discard</Text>
            </RNView>
          </RNView>
          {!!status && <Text style={[styles.status, myTurn && { color: C.gold }]}>{status}</Text>}
          {!!notice && (
            <Animated.Text entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.toast}>
              {notice}
            </Animated.Text>
          )}
        </RNView>
        {side(place.right)}
      </RNView>

      <RNView style={styles.bottom}>
        <RNView style={styles.myRow}>
          {seatBox(me)}
          <RNView style={styles.myCombos}>
            {combos(me)}
            {staged.map((g, i) => {
              const c = checkCombo(cardsOf(g));
              return <Text key={i} style={[styles.group, !c && { color: C.red, borderColor: C.red }]}>{c ? `${c.type === "TRIA" ? "Tria" : "Serie"} ${c.points}` : "Not a combination"}</Text>;
            })}
          </RNView>
          <RNView style={styles.actions}>
            {sortOpen && (
              <RNView style={styles.sortMenu}>
                <Button label="By suit" onPress={() => sort(bySuit)} />
                <Button label="By rank" onPress={() => sort(byRank)} />
              </RNView>
            )}
            <Button label="Sort" icon={<ArrowDownUp size={16} color={C.ivory} />} onPress={() => setSortOpen(!sortOpen)} />
            <Button label="Group" icon={<Layers size={16} color={sel.length >= 3 ? C.ivory : C.muted} />} onPress={group} disabled={sel.length < 3} />
            <Button label="Talaj" kind="primary" icon={<Check size={16} color={canTalaj ? C.surface : C.muted} />} onPress={talaj} disabled={!canTalaj} />
            <Button label="Discard" kind={canTalaj ? "secondary" : "primary"} icon={<ArrowDownToLine size={16} color={!canDiscard ? C.muted : canTalaj ? C.ivory : C.surface} />} onPress={discard} disabled={!canDiscard} />
          </RNView>
        </RNView>
        <RNView style={styles.hand}>
          {hand.map((c) => (
            <HandCard key={c.id} card={c} selected={sel.includes(c.id)} grouped={inGroup.has(c.id)} fresh={fresh === c.id} onPress={() => tapCard(c.id)} onDrop={dropCard} />
          ))}
        </RNView>
      </RNView>

      {dropped && (
        <RNView style={styles.reconnect} pointerEvents="none">
          <Loader size={14} color={C.ivory} />
          <Text style={styles.reconnectText}>Reconnecting to the game…</Text>
        </RNView>
      )}

      {lastRound && (
        <RoundResult
          round={lastRound}
          number={view.rounds.length}
          units={units}
          totals={view.totals}
          winnerName={nameOf(lastRound.winner)}
          onClose={() => setSeenRounds(view.rounds.length)}
          onScores={() => (setSeenRounds(view.rounds.length), setSheet("scores"))}
        />
      )}

      {view.status === "finished" && view.winner !== null && <FinalResult winner={view.winner} units={units} totals={view.totals} rounds={view.rounds.length} onHome={onLeave} />}

      <Scoreboard visible={sheet === "scores"} onClose={() => setSheet(null)} units={units} rounds={view.rounds} totals={view.totals} target={view.target} />
      <GameMenu visible={sheet === "menu"} onClose={() => setSheet(null)} code={view.code} onLeave={onLeave} />
    </RNView>
  );
}

const styles = StyleSheet.create({
  table: { flex: 1, backgroundColor: C.table, padding: 6 },
  topRow: { flexDirection: "row", alignItems: "flex-start", minHeight: 48 },
  topSeat: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  corner: { flexDirection: "row", alignItems: "center", gap: 2 },
  iconButton: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#00000033" },
  conn: { width: 24, alignItems: "center" },
  middle: { flex: 1, flexDirection: "row" },
  side: { width: "24%", alignItems: "center", gap: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  piles: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  pileLabel: { alignItems: "center", gap: 2 },
  pile: { padding: 3, borderRadius: 9, borderWidth: 1.5, borderColor: "transparent" },
  pileText: { color: C.muted, fontSize: 11, fontFamily: F.regular },
  target: { borderColor: C.gold },
  chip: { color: C.ivory, backgroundColor: "#00000040", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, fontSize: 11, fontFamily: F.regular, overflow: "hidden" },
  status: { color: C.ivory, fontSize: 13, fontFamily: F.semi },
  toast: { color: C.ivory, backgroundColor: C.red, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, fontSize: 13, fontFamily: F.semi, overflow: "hidden" },
  bottom: { gap: 2 },
  myRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  myCombos: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  hand: { flexDirection: "row", justifyContent: "center", paddingTop: 16 },
  actions: { flexDirection: "row", gap: 6 },
  sortMenu: { position: "absolute", left: 0, bottom: 50, gap: 4, backgroundColor: C.surface, padding: 6, borderRadius: 12, borderWidth: 1, borderColor: C.line, zIndex: 20 },
  combos: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  combosVertical: { flexDirection: "column", alignItems: "center" },
  combo: { flexDirection: "row", padding: 3, paddingRight: 7, borderRadius: 8, backgroundColor: "#0000002e", borderWidth: 1.5, borderColor: "transparent" },
  comboCard: { marginRight: -4 },
  group: { color: C.gold, fontSize: 12, fontFamily: F.semi, borderWidth: 1, borderColor: C.gold, borderStyle: "dashed", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  backText: { position: "absolute", alignSelf: "center", top: 20, color: C.ivory, fontFamily: F.bold, fontVariant: ["tabular-nums"], textShadowColor: "black", textShadowRadius: 3 },
  empty: { width: 42, height: 60, borderRadius: 6, borderWidth: 1, borderStyle: "dashed", borderColor: "#ffffff55" },
  reconnect: { position: "absolute", top: 8, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: C.line },
  reconnectText: { color: C.ivory, fontSize: 12, fontFamily: F.semi },
});
