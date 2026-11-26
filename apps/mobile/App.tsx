import type { Room } from "@colyseus/sdk";
import type { Move } from "@rami/rules";
import type { Session } from "@supabase/supabase-js";
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, useFonts } from "@expo-google-fonts/inter";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { connect, sendMove, type PartyOptions, type View } from "./src/game";
import { Home } from "./src/Home";
import { Lobby } from "./src/Lobby";
import { SignIn } from "./src/SignIn";
import { supabase } from "./src/supabase";
import { C } from "./src/ui";
import { Table } from "./src/Table";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1) + ".";

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [room, setRoom] = useState<Room | null>(null);
  const [view, setView] = useState<{ view: View; at: number } | null>(null);
  const [notice, setNotice] = useState("");
  const [dropped, setDropped] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const flash = (text: string) => {
    clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = setTimeout(() => setNotice(""), 3000);
  };

  const open = async (how: { create: PartyOptions } | { code: string }) => {
    setBusy(true);
    setError("");
    try {
      const r = await connect(how);
      r.onMessage("view", (v: View) => setView({ view: v, at: Date.now() }));
      // F3: an illegal move changes nothing; show the server's reason.
      r.onMessage("rejected", (x: { message: string }) => flash(sentence(x.message)));
      r.onDrop(() => setDropped(true));
      r.onReconnect(() => setDropped(false));
      r.onLeave(() => (setRoom(null), setView(null), setDropped(false)));
      setRoom(r);
    } catch (e) {
      setError(sentence(message(e)));
    } finally {
      setBusy(false);
    }
  };

  const leave = () => room?.leave();
  const move = (m: Move) => room && sendMove(room, m);

  let screen;
  if (session === undefined || (!fontsLoaded && !fontError)) screen = null;
  else if (!session) screen = <SignIn />;
  else if (!room || !view) screen = <Home session={session} busy={busy || !!room} error={error} onCreate={(o) => open({ create: o })} onJoin={(code) => open({ code })} />;
  else if (view.view.status === "lobby") screen = <Lobby view={view.view} onLeave={leave} />;
  else screen = <Table view={view.view} receivedAt={view.at} notice={notice} dropped={dropped} onMove={move} onLeave={leave} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar hidden />
      {/* Android draws edge to edge, so keep content clear of the nav bar and any notch. */}
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>{screen}</SafeAreaView>
    </GestureHandlerRootView>
  );
}
