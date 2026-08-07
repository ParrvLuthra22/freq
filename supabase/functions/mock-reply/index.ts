// mock-reply
//
// Called after the client inserts the human's message into a thread with a
// mock candidate. Generates one short, in-character reply and inserts it as
// that mock — never as a fabricated "assistant" — so the thread reads as a
// person, not a bot bolted onto the UI.
//
// Also doubles as where a mock "plays" an in-thread game: when the triggering
// message is a `quiz`/`take` game-start rather than text, this makes the
// mock's move in `game_sessions` instead of generating a reply — no LLM call,
// no new message, just the same session row the human is already looking at
// picking up a second field. The client calls this function either way; which
// path runs is decided entirely by the trigger's type.
//
// ANTHROPIC_API_KEY lives only in this function's secrets (`supabase secrets
// set ANTHROPIC_API_KEY=...`), never in the app: the client has no path to it,
// and nothing here ever echoes it back in a response.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_REPLY_TOKENS = 120;
const THREAD_HISTORY_LIMIT = 12;

// Two independent caps, because "the demo account can't run up cost" is an
// aggregate concern, not just a fairness-between-users one: anonymous sign-in
// gives every visitor a distinct profile, so a per-profile limit alone does
// not bound total spend across many demo sessions.
const PER_PROFILE_HOURLY_LIMIT = 20;
const GLOBAL_HOURLY_LIMIT = 200;

// A human-feeling pause before the reply lands — independent of, and shorter
// than, the client's MATCH_DELAY for a like-back confirmation.
const MIN_TYPING_MS = 1100;
const MAX_TYPING_MS = 3200;

// A game move needs no LLM call, so there is no reason for it to take as long
// as composing a reply — just enough of a pause that it still reads as
// "thinking it over" rather than an instant, mechanical response.
const MIN_MOVE_MS = 900;
const MAX_MOVE_MS = 2200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Profile = {
  id: string;
  name: string;
  is_mock: boolean;
  archetype: { name?: string; description?: string } | null;
  tags: string[] | null;
  top_artists: { name: string; rank: number }[] | null;
  song: { title?: string; artist?: string } | null;
  line: string | null;
  flirt: string | null;
  take_answer: number | null;
};

type QuizState = {
  mockOptions: string[];
  mockAnswer: string;
  userGuess: string | null;
  userOptions: string[];
  userAnswer: string;
  mockGuess: string | null;
};

type TakeState = {
  prompt: string;
  userValue: number | null;
  mockValue: number | null;
};

type MessageRow = {
  id: string;
  sender_id: string;
  type: string;
  body: Record<string, unknown>;
  created_at: string;
};

/** FREQ's brand voice, grounded in this specific mock's authored personality. */
function buildSystemPrompt(mock: Profile, meName: string): string {
  const archetype = mock.archetype?.name ? `${mock.archetype.name}` : 'a specific, opinionated listener';
  const archetypeLine = mock.archetype?.description ?? '';
  const rareArtists = (mock.top_artists ?? [])
    .filter((a) => a.rank < 35)
    .map((a) => a.name)
    .slice(0, 4);
  const tags = (mock.tags ?? []).slice(0, 4).join(', ');

  return [
    `You are ${mock.name}, ${archetype}, texting on FREQ — a music-taste dating app. ${archetypeLine}`,
    rareArtists.length > 0 ? `Your rare, defining artists: ${rareArtists.join(', ')}.` : '',
    tags ? `Your taste in a few words: ${tags}.` : '',
    mock.line ? `Something true about your habits: ${mock.line}` : '',
    mock.flirt ? `A line that captures your tone: "${mock.flirt}"` : '',
    '',
    `You are mid-conversation with ${meName}, someone FREQ matched you with on real listening overlap.`,
    '',
    'Voice: flirty through wit, never volume. Specific and knowing — name the actual artist, the hour, ' +
      'the rare overlap, not a vague compliment. Warm, adult, a little teasing. Sentence case, real ' +
      'punctuation, em dashes where they earn it. Never emoji. Never crude. Never judgmental about ' +
      'anyone\'s taste, including your own.',
    'Reply as yourself, in character, to their most recent message. One to two sentences. No stage ' +
      'directions, no "as an AI", no quotation marks around the reply — just what you would actually send.',
  ]
    .filter(Boolean)
    .join('\n');
}

function threadToTranscript(messages: MessageRow[], meId: string, meName: string, mockName: string): string {
  return messages
    .map((m) => {
      const speaker = m.sender_id === meId ? meName : mockName;
      const text =
        m.type === 'song'
          ? `[shared a song: ${(m.body as { title?: string }).title ?? ''}]`
          : String((m.body as { text?: string }).text ?? '');
      return `${speaker}: ${text}`;
    })
    .join('\n');
}

async function generateReply(mock: Profile, meName: string, messages: MessageRow[], meId: string): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_REPLY_TOKENS,
      system: buildSystemPrompt(mock, meName),
      messages: [
        {
          role: 'user',
          content: `The conversation so far:\n${threadToTranscript(messages, meId, meName, mock.name)}\n\nSend your next message.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    console.error('Anthropic API error', res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  return typeof text === 'string' && text.trim().length > 0 ? text.trim() : null;
}

/**
 * The mock's move in a game session — a guess for `quiz`, a locked-in slider
 * value for `take`. No LLM call: a `quiz` guess is picked uniformly at random
 * from the same options the human sees (real guessing, not a scripted
 * correct/incorrect), and a `take` value is the mock's own authored
 * `take_answer`, already seeded per profile.
 */
async function makeGameMove(
  serviceClient: ReturnType<typeof createClient>,
  mock: Profile,
  sessionId: string
): Promise<{ moved: boolean; reason?: string }> {
  const { data: session, error } = await serviceClient
    .from('game_sessions')
    .select('id, game, state')
    .eq('id', sessionId)
    .single();
  if (error || !session) return { moved: false, reason: 'session not found' };

  const game = session.game as 'quiz' | 'take';
  let patch: Record<string, unknown>;

  if (game === 'quiz') {
    const quiz = session.state as QuizState;
    if (quiz.mockGuess !== null) return { moved: false, reason: 'already moved' };
    const options = quiz.userOptions;
    patch = { mockGuess: options[Math.floor(Math.random() * options.length)] };
  } else {
    const take = session.state as TakeState;
    if (take.mockValue !== null) return { moved: false, reason: 'already moved' };
    patch = { mockValue: mock.take_answer ?? 50 };
  }

  await sleep(MIN_MOVE_MS + Math.random() * (MAX_MOVE_MS - MIN_MOVE_MS));

  const { error: patchError } = await serviceClient.rpc('patch_game_state', {
    session_id: sessionId,
    patch,
  });
  if (patchError) {
    console.error('patch_game_state failed', patchError);
    return { moved: false, reason: 'patch failed' };
  }
  return { moved: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, 401);

  let matchId: string;
  try {
    const body = await req.json();
    matchId = body.match_id;
    if (!matchId || typeof matchId !== 'string') {
      return jsonResponse({ error: 'match_id is required' }, 400);
    }
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

  const { data: me } = await userClient.from('profiles').select('id, name').eq('auth_id', user.id).single();
  if (!me) return jsonResponse({ error: 'No profile for this account' }, 404);

  // matches_select_member RLS means this row only comes back if `me` is
  // actually in it — a non-member's match_id resolves to "not found", which
  // doubles as the membership check.
  const { data: match } = await userClient.from('matches').select('a, b').eq('id', matchId).single();
  if (!match) return jsonResponse({ error: 'Match not found' }, 404);

  const mockProfileId = match.a === me.id ? match.b : match.a;
  const { data: mock } = await userClient
    .from('profiles')
    .select('id, name, is_mock, archetype, tags, top_artists, song, line, flirt, take_answer')
    .eq('id', mockProfileId)
    .single();
  if (!mock) return jsonResponse({ error: 'Other profile not found' }, 404);

  // A real signed-in person does not get an AI-voiced reply on their behalf —
  // this whole function exists for scripted candidates only.
  if (!mock.is_mock) {
    return jsonResponse({ skipped: true, reason: 'match is not with a mock profile' }, 200);
  }

  const { data: history } = await userClient
    .from('messages')
    .select('id, sender_id, type, body, created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false })
    .limit(THREAD_HISTORY_LIMIT);

  const messages = (history ?? []).slice().reverse();
  const trigger = messages[messages.length - 1];

  // Nothing to reply to, or the most recent line is already the mock's own —
  // a duplicate invoke racing the first one. Either way, do not generate again.
  if (!trigger || trigger.sender_id !== me.id) {
    return jsonResponse({ skipped: true, reason: 'no new human message to reply to' }, 200);
  }

  // A game-start message needs a move, not a reply — no LLM, no new message,
  // no usage ledger, just the mock's field in the same session row the human
  // is already looking at.
  if (trigger.type === 'quiz' || trigger.type === 'take') {
    const sessionId = (trigger.body as { session_id?: string }).session_id;
    if (!sessionId) {
      return jsonResponse({ skipped: true, reason: 'game message missing session_id' }, 200);
    }

    const gameServiceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const later = makeGameMove(gameServiceClient, mock as Profile, sessionId);

    // @ts-ignore — EdgeRuntime is a Supabase Edge Functions / Deno Deploy global.
    if (typeof EdgeRuntime !== 'undefined') {
      // @ts-ignore — see above.
      EdgeRuntime.waitUntil(later);
    } else {
      await later;
    }

    return jsonResponse({ accepted: true, kind: 'game_move' });
  }

  // Everything past this point touches usage accounting and does privileged
  // writes, so it runs on the service-role client — mock_reply_usage denies
  // authenticated entirely by design.
  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: cached } = await serviceClient
    .from('mock_reply_usage')
    .select('reply_message_id')
    .eq('in_reply_to', trigger.id)
    .maybeSingle();
  if (cached) {
    return jsonResponse({ cached: true, reply_message_id: cached.reply_message_id });
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count: perProfileCount } = await serviceClient
    .from('mock_reply_usage')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', me.id)
    .gte('created_at', hourAgo);
  if ((perProfileCount ?? 0) >= PER_PROFILE_HOURLY_LIMIT) {
    return jsonResponse({ error: 'rate_limited', scope: 'profile' }, 429);
  }

  const { count: globalCount } = await serviceClient
    .from('mock_reply_usage')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', hourAgo);
  if ((globalCount ?? 0) >= GLOBAL_HOURLY_LIMIT) {
    return jsonResponse({ error: 'rate_limited', scope: 'global' }, 429);
  }

  const later = (async () => {
    const reply = await generateReply(mock as Profile, me.name, messages as MessageRow[], me.id);
    if (!reply) return; // Anthropic unreachable or empty completion — say nothing rather than something wrong.

    await sleep(MIN_TYPING_MS + Math.random() * (MAX_TYPING_MS - MIN_TYPING_MS));

    const { data: inserted, error: insertError } = await serviceClient
      .from('messages')
      .insert({ match_id: matchId, sender_id: mockProfileId, type: 'text', body: { text: reply } })
      .select('id')
      .single();
    if (insertError || !inserted) {
      console.error('failed to insert mock reply', insertError);
      return;
    }

    await serviceClient.from('mock_reply_usage').insert({
      profile_id: me.id,
      match_id: matchId,
      in_reply_to: trigger.id,
      reply_message_id: inserted.id,
    });
  })();

  // @ts-ignore — EdgeRuntime is a Supabase Edge Functions / Deno Deploy global.
  if (typeof EdgeRuntime !== 'undefined') {
    // @ts-ignore — see above.
    EdgeRuntime.waitUntil(later);
  } else {
    await later;
  }

  return jsonResponse({ accepted: true });
});
