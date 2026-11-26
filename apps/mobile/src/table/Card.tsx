import type { Card } from "@rami/rules";
import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { FadeInDown, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { CARD_IMAGES } from "../cardImages";
import { C } from "../ui";

const RANK_NAMES: Record<string, string> = { A: "Ace", J: "Jack", Q: "Queen", K: "King" };
const SUIT_NAMES: Record<string, string> = { H: "Hearts", D: "Diamonds", S: "Spades", C: "Clubs" };
/** Screen reader label, for example "Queen of Hearts". */
export const cardName = (c: Card) => (c.rank === "JOKER" ? "Joker" : `${RANK_NAMES[c.rank] ?? c.rank} of ${SUIT_NAMES[c.suit!]}`);

/** The PNGs are 64x64 with the card at x 11..53, y 2..62, so the frame crops to that 42x60 face. Card ids are `${deck}${rank}${suit}`. */
export function CardFace({ card, scale = 1, selected, fresh, onPress, children }: { card: Card | null; scale?: number; selected?: boolean; fresh?: boolean; onPress?: () => void; children?: ReactNode }) {
  const s = scale;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "image"}
      accessibilityLabel={card ? cardName(card) : "Card back"}
      accessibilityState={{ selected: !!selected }}
      style={[styles.card, { width: 42 * s, height: 60 * s, borderRadius: 6 * s }, selected && styles.selected, fresh && styles.fresh]}
    >
      <Image source={CARD_IMAGES[card ? card.id.slice(1) : "back"]} style={{ width: 64 * s, height: 64 * s, marginLeft: -11 * s, marginTop: -2 * s }} />
      {children}
    </Pressable>
  );
}

/** A face-down pile: two offset backs under the top one suggest its thickness. */
export function CardStack({ scale = 1, layers = 2, children }: { scale?: number; layers?: number; children: ReactNode }) {
  return (
    <View style={{ paddingLeft: layers * 2, paddingTop: layers * 2 }}>
      {Array.from({ length: layers }, (_, i) => (
        <View key={i} style={[styles.layer, { left: i * 2, top: i * 2, width: 42 * scale, height: 60 * scale, borderRadius: 6 * scale }]} />
      ))}
      {children}
    </View>
  );
}

/** A hand card you can tap to select or drag onto a combination or the discard pile. `onDrop` says whether a move was sent. */
export function HandCard({ card, selected, grouped, fresh, onPress, onDrop }: { card: Card; selected: boolean; grouped: boolean; fresh: boolean; onPress: () => void; onDrop: (id: string, x: number, y: number) => Promise<boolean> }) {
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
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: 1 + 0.12 * lift.value }],
  }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View entering={FadeInDown.duration(250)} exiting={FadeOut.duration(220)} layout={LinearTransition.duration(250)} style={[styles.handSlot, grouped && styles.grouped, moving]}>
        <CardFace card={card} selected={selected} fresh={fresh} onPress={onPress} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden", backgroundColor: C.ivory, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  selected: { transform: [{ translateY: -16 }], outlineColor: C.gold, outlineWidth: 2 },
  fresh: { outlineColor: C.ivory, outlineWidth: 2 },
  layer: { position: "absolute", backgroundColor: "#2b3a55", borderWidth: 1, borderColor: "#ffffff30" },
  handSlot: { flex: 1, maxWidth: 46, alignItems: "center" },
  grouped: { opacity: 0.45 },
});
