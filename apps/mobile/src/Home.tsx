import { DEFAULT_TARGET } from "@rami/rules";
import type { Session } from "@supabase/supabase-js";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import type { PartyOptions } from "./game";
import { supabase } from "./supabase";
import { ui } from "./ui";

type Props = { session: Session; busy: boolean; error: string; onCreate: (o: PartyOptions) => void; onJoin: (code: string) => void };

/** F2: create a party (2, 3 or 4 players, companion mode, target score) or join one by code. */
export function Home({ session, busy, error, onCreate, onJoin }: Props) {
  const meta = session.user.user_metadata as { full_name?: string; name?: string; avatar_url?: string; picture?: string };
  const photo = meta.avatar_url ?? meta.picture;
  const [players, setPlayers] = useState(4);
  const [companion, setCompanion] = useState(false);
  const [target, setTarget] = useState(String(DEFAULT_TARGET));
  const [code, setCode] = useState("");
  const targetNum = Number(target);
  const validTarget = Number.isInteger(targetNum) && targetNum > 0;

  return (
    <View style={[ui.screen, styles.columns]}>
      <View style={styles.column}>
        <View style={ui.row}>
          {photo && <Image source={{ uri: photo }} style={styles.avatar} />}
          <Text style={ui.title}>{meta.full_name ?? meta.name ?? ""}</Text>
        </View>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={ui.text}>Sign out</Text>
        </Pressable>
        {!!error && <Text style={ui.error}>{error}</Text>}
      </View>

      <View style={styles.column}>
        <Text style={ui.text}>New party</Text>
        <View style={ui.row}>
          {[2, 3, 4].map((n) => (
            <Pressable key={n} style={[ui.button, styles.small, players !== n && ui.disabled]} onPress={() => (setPlayers(n), n !== 4 && setCompanion(false))}>
              <Text style={ui.buttonText}>{n} players</Text>
            </Pressable>
          ))}
        </View>
        <View style={ui.row}>
          <Text style={ui.text}>Companion mode (2 vs 2)</Text>
          <Switch value={companion} onValueChange={setCompanion} disabled={players !== 4} />
        </View>
        <View style={ui.row}>
          <Text style={ui.text}>Target score</Text>
          <TextInput style={ui.input} value={target} onChangeText={setTarget} keyboardType="number-pad" />
        </View>
        <Pressable style={[ui.button, (busy || !validTarget) && ui.disabled]} disabled={busy || !validTarget} onPress={() => onCreate({ players, companion, target: targetNum })}>
          <Text style={ui.buttonText}>Create party</Text>
        </Pressable>
      </View>

      <View style={styles.column}>
        <Text style={ui.text}>Join with a code</Text>
        <TextInput style={ui.input} value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} maxLength={6} placeholder="ABC123" />
        <Pressable style={[ui.button, (busy || code.trim().length !== 6) && ui.disabled]} disabled={busy || code.trim().length !== 6} onPress={() => onJoin(code)}>
          <Text style={ui.buttonText}>Join</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-evenly" },
  column: { alignItems: "center", gap: 10, flexShrink: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  small: { minWidth: 0, paddingHorizontal: 10 },
});
