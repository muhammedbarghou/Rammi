/** The shape `public.save_match(jsonb)` reads (supabase/migrations). */
export type MatchResult = {
  party_code: string;
  mode: "solo" | "companion";
  player_count: number;
  target_score: number;
  created_by: string;
  started_at: string;
  ended_at: string;
  winner_team_or_player: string;
  players: { profile_id: string; seat: number; team: number | null; final_score: number; forfeited: boolean }[];
  rounds: {
    round_number: number;
    starter_seat: number;
    winner_seat: number;
    scores: { profile_id: string; penalty: number; opened: boolean; opening_total: number | null }[];
  }[];
};

/** Saves a finished match in one transaction. SUPABASE_SECRET_KEY is an `sb_secret_...` key, which needs only the apikey header. */
export async function saveMatch(match: MatchResult): Promise<void> {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/save_match`, {
    method: "POST",
    headers: { apikey: process.env.SUPABASE_SECRET_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({ m: match }),
  });
  if (!res.ok) throw new Error(`save_match failed (${res.status}): ${await res.text()}`);
}
