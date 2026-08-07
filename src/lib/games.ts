import { getMe, getUsers, type DiscoverUser } from '@/lib/seed';
import { sendMessage, type StoredMessage } from '@/lib/chat';
import { supabase } from '@/lib/supabase';

/**
 * The in-thread games: structured messages (`messages.type = 'quiz' | 'take'`)
 * whose live state lives in `game_sessions`, not in the message body. A game
 * message only ever carries `{ session_id }` — the card that renders it reads
 * and subscribes to the session row for everything that actually changes.
 *
 * One session per (match, game) — `game_sessions` has `unique(match_id, game)`
 * on purpose, so each game gets played once per match, same as the real thing.
 */

export type GameKind = 'quiz' | 'take';

/** Guess Their #1 — two independent one-question rounds, one per direction. */
export type QuizState = {
  /** What the human picks from — the mock's authored quiz content. */
  mockOptions: string[];
  mockAnswer: string;
  userGuess: string | null;
  /** What the mock picks from — generated once at game start, so both sides see the same four. */
  userOptions: string[];
  userAnswer: string;
  mockGuess: string | null;
};

export type TakeState = {
  prompt: string;
  userValue: number | null;
  mockValue: number | null;
};

export type GameSession =
  | { id: string; matchId: string; game: 'quiz'; state: QuizState }
  | { id: string; matchId: string; game: 'take'; state: TakeState };

const HOT_TAKE_PROMPT = 'First instinct — how much of a match are we, really?';

function shuffled<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickDistractors(
  correct: string,
  pool: string[],
  count: number,
): string[] {
  const candidates = Array.from(new Set(pool)).filter(
    (name) => name !== correct,
  );
  const picked: string[] = [];
  while (picked.length < count && candidates.length > 0) {
    const i = Math.floor(Math.random() * candidates.length);
    picked.push(candidates.splice(i, 1)[0]);
  }
  return picked;
}

/** Every artist name across the loaded corpus — the distractor pool for "guess their #1". */
function artistPool(): string[] {
  const names = new Set<string>();
  for (const artist of getMe().topArtists) names.add(artist.name);
  for (const user of getUsers()) {
    for (const artist of user.topArtists) names.add(artist.name);
  }
  return Array.from(names);
}

function buildQuizState(mock: DiscoverUser): QuizState {
  const me = getMe();
  const userAnswer = me.topArtists[0]?.name ?? me.currentFrequency;
  const userOptions = shuffled([
    userAnswer,
    ...pickDistractors(userAnswer, artistPool(), 3),
  ]);

  return {
    mockOptions: mock.quiz.options,
    mockAnswer: mock.quiz.answer,
    userGuess: null,
    userOptions,
    userAnswer,
    mockGuess: null,
  };
}

function buildTakeState(): TakeState {
  return { prompt: HOT_TAKE_PROMPT, userValue: null, mockValue: null };
}

type SessionRow = {
  id: string;
  match_id: string;
  game: GameKind;
  state: Record<string, unknown>;
};

function mapSession(row: SessionRow): GameSession {
  return {
    id: row.id,
    matchId: row.match_id,
    game: row.game,
    state: row.state,
  } as GameSession;
}

const SESSION_COLUMNS = 'id, match_id, game, state';

/** Every game already started in this match — lets the picker sheet grey out what's been played. */
export async function fetchGameSessions(
  matchId: string,
): Promise<GameSession[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('game_sessions')
    .select(SESSION_COLUMNS)
    .eq('match_id', matchId);
  if (error || !data) return [];
  return (data as SessionRow[]).map(mapSession);
}

export async function fetchGameSession(
  sessionId: string,
): Promise<GameSession | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('game_sessions')
    .select(SESSION_COLUMNS)
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !data) return null;
  return mapSession(data as SessionRow);
}

/**
 * Starts a game: creates its session row, then a `game`-typed message
 * referencing it. Two calls, not one transaction — same tolerance the rest of
 * this client already has for a two-step write (see `profile-sync.ts`), and a
 * failed second step only orphans an unreferenced session row, never a
 * message with nothing behind it.
 */
export async function startGame(
  matchId: string,
  kind: GameKind,
  mock: DiscoverUser,
): Promise<{ session: GameSession; message: StoredMessage } | null> {
  if (!supabase) return null;

  const state = kind === 'quiz' ? buildQuizState(mock) : buildTakeState();

  const { data, error } = await supabase
    .from('game_sessions')
    .insert({ match_id: matchId, game: kind, state })
    .select(SESSION_COLUMNS)
    .single();
  if (error || !data) return null;

  const session = mapSession(data as SessionRow);
  const message = await sendMessage(matchId, kind, { session_id: session.id });
  if (!message) return null;

  return { session, message };
}

/**
 * Merges `patch` into a session's `state` via `patch_game_state` — a DB-side
 * `state || patch`, not a client fetch-then-replace. The human and the mock
 * write different keys (`userGuess` vs `mockGuess`, say) but can land within
 * moments of each other; a plain "read state, spread, write the whole column
 * back" would risk one write clobbering the other depending on which read
 * happened first. Still subject to the normal `game_sessions` RLS — this
 * function runs with the caller's own privileges, not elevated ones.
 */
async function patchGameState(
  sessionId: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('patch_game_state', {
    session_id: sessionId,
    patch,
  });
  if (error || !data || data.length === 0) return null;
  return (data[0] as { state: Record<string, unknown> }).state;
}

export async function submitQuizGuess(
  sessionId: string,
  artist: string,
): Promise<QuizState | null> {
  const state = await patchGameState(sessionId, { userGuess: artist });
  return state as QuizState | null;
}

export async function submitTakeValue(
  sessionId: string,
  value: number,
): Promise<TakeState | null> {
  const state = await patchGameState(sessionId, {
    userValue: Math.round(value),
  });
  return state as TakeState | null;
}

/**
 * Live state changes for one session — both an opponent's move landing and
 * the echo of the caller's own write. Requires `public.game_sessions` in the
 * `supabase_realtime` publication (see the migrations).
 */
export function subscribeToGameSession(
  sessionId: string,
  onUpdate: (state: QuizState | TakeState) => void,
): () => void {
  const client = supabase;
  if (!client) return () => {};

  const channel = client
    .channel(`game_sessions:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_sessions',
        filter: `id=eq.${sessionId}`,
      },
      (payload) => {
        const row = payload.new as { state: QuizState | TakeState };
        onUpdate(row.state);
      },
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
