-- PRD section 8. Live game state never comes here; only finished matches (written by the game server).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  party_code text not null,
  mode text not null check (mode in ('solo', 'companion')),
  player_count int not null check (player_count between 2 and 4),
  target_score int not null default 501,
  created_by uuid not null references public.profiles (id),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  winner_team_or_player text
);

create table public.match_players (
  match_id uuid not null references public.matches (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  seat int not null check (seat between 0 and 3),
  team int check (team in (0, 1)),
  final_score int not null,
  forfeited boolean not null default false,
  primary key (match_id, seat)
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  round_number int not null,
  starter_seat int not null,
  winner_seat int,
  unique (match_id, round_number)
);

create table public.round_scores (
  round_id uuid not null references public.rounds (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  penalty int not null,
  opened boolean not null,
  opening_total int,
  primary key (round_id, profile_id)
);

create index on public.match_players (profile_id);
create index on public.rounds (match_id);
create index on public.round_scores (profile_id);
create index on public.matches (created_by);

-- Clients get no access yet; the game server writes with the secret key, which bypasses RLS.
alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.rounds enable row level security;
alter table public.round_scores enable row level security;

create policy "signed-in users can read profiles" on public.profiles
  for select to authenticated using (true);

-- F1: name and photo come from the social login.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- One call, one transaction: a finished match is saved whole or not at all.
create function public.save_match(m jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_match uuid;
  v_round uuid;
  r jsonb;
begin
  insert into public.matches (party_code, mode, player_count, target_score, created_by, started_at, ended_at, winner_team_or_player)
  values (
    m ->> 'party_code', m ->> 'mode', (m ->> 'player_count')::int, (m ->> 'target_score')::int,
    (m ->> 'created_by')::uuid, (m ->> 'started_at')::timestamptz, (m ->> 'ended_at')::timestamptz,
    m ->> 'winner_team_or_player'
  )
  returning id into v_match;

  insert into public.match_players (match_id, profile_id, seat, team, final_score, forfeited)
  select v_match, (p ->> 'profile_id')::uuid, (p ->> 'seat')::int, (p ->> 'team')::int,
         (p ->> 'final_score')::int, (p ->> 'forfeited')::boolean
  from jsonb_array_elements(m -> 'players') as x (p);

  for r in select * from jsonb_array_elements(m -> 'rounds') loop
    insert into public.rounds (match_id, round_number, starter_seat, winner_seat)
    values (v_match, (r ->> 'round_number')::int, (r ->> 'starter_seat')::int, (r ->> 'winner_seat')::int)
    returning id into v_round;

    insert into public.round_scores (round_id, profile_id, penalty, opened, opening_total)
    select v_round, (s ->> 'profile_id')::uuid, (s ->> 'penalty')::int, (s ->> 'opened')::boolean,
           (s ->> 'opening_total')::int
    from jsonb_array_elements(r -> 'scores') as y (s);
  end loop;

  return v_match;
end $$;

revoke execute on function public.save_match (jsonb) from public, anon, authenticated;
grant execute on function public.save_match (jsonb) to service_role;
revoke execute on function public.handle_new_user () from public, anon, authenticated;
