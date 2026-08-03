import { getUsers, type Artist, type Me, type Track } from '@/lib/seed';

/**
 * The Weekly FREQ Drop — a recap built only from data the app actually holds.
 *
 * Every figure here is computed from the listening history and live scores, so
 * nothing in the recap is decorative. A Wrapped-style moment is only good if the
 * numbers are true; invented ones read as filler immediately.
 */

/** Hours that count as after-hours listening. */
const NIGHT_HOURS = [0, 1, 2, 3, 4];
/** Same obscurity threshold the profile uses for its "Rare" chip. */
const RARE_RANK = 35;

export type WeeklyStat = {
  label: string;
  value: string;
  /** Optional aside, in voice. */
  note?: string;
};

export type WeeklyDrop = {
  headline: string;
  accent: string;
  stats: WeeklyStat[];
  topArtist: Artist | null;
  topTrack: Track | null;
  peakHour: number;
  listeningHours: number[];
};

export function formatHour(hour: number): string {
  if (hour === 0) return 'midnight';
  if (hour === 12) return 'noon';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

/**
 * Pick the headline from whichever signal is genuinely most extreme, so the
 * recap leads with what is actually distinctive about the week rather than
 * always opening on the same line.
 */
function buildHeadline(nightShare: number, rareShare: number, peakHour: number) {
  if (nightShare >= 40) {
    return { headline: 'Your best listening happened', accent: 'after midnight.' };
  }
  if (rareShare >= 50) {
    return { headline: 'Half your rotation is stuff', accent: 'nobody else here plays.' };
  }
  if (peakHour >= 5 && peakHour <= 10) {
    return { headline: 'You front-load your week —', accent: 'mornings are yours.' };
  }
  return { headline: 'A week with a shape', accent: 'only you have.' };
}

export function buildWeeklyDrop(me: Me, likedIds: string[]): WeeklyDrop {
  const hours = me.listeningHours;
  const total = hours.reduce((sum, value) => sum + value, 0);

  const peakHour = hours.reduce((best, value, i) => (value > hours[best] ? i : best), 0);
  const nightShare = pct(
    NIGHT_HOURS.reduce((sum, hour) => sum + (hours[hour] ?? 0), 0),
    total
  );

  const rareArtists = me.topArtists.filter((artist) => artist.rank < RARE_RANK);
  const rareShare = pct(rareArtists.length, me.topArtists.length);

  const ranked = getUsers();
  const best = ranked[0];

  // The rarest artist you share with anyone in range — the single most flattering
  // fact the corpus can produce about your taste.
  let rarest: { name: string; withWhom: string } | null = null;
  for (const user of ranked) {
    for (const name of user.match.sharedArtists) {
      const artist = me.topArtists.find((a) => a.name === name);
      if (!artist) continue;
      const incumbent = rarest ? me.topArtists.find((a) => a.name === rarest!.name) : undefined;
      if (!incumbent || artist.rank < incumbent.rank) {
        rarest = { name, withWhom: user.name };
      }
    }
  }

  const { headline, accent } = buildHeadline(nightShare, rareShare, peakHour);

  const stats: WeeklyStat[] = [
    {
      label: 'Peak hour',
      value: formatHour(peakHour),
      note: nightShare >= 40 ? `${nightShare}% of your listening is after hours` : undefined,
    },
    {
      label: 'Rare taste',
      value: `${rareShare}%`,
      note: `${rareArtists.length} of your ${me.topArtists.length} top artists are deep cuts`,
    },
  ];

  if (rarest) {
    stats.push({
      label: 'Rarest overlap',
      value: rarest.name,
      note: `You and ${rarest.withWhom} both found it`,
    });
  }

  if (best) {
    stats.push({
      label: 'Closest frequency',
      value: `${best.name} · ${best.match.score}`,
      note: best.match.reasons[0],
    });
  }

  stats.push({
    label: 'Reacted this week',
    value: String(likedIds.length),
    note: likedIds.length === 0 ? 'Still deciding — fair enough' : undefined,
  });

  return {
    headline,
    accent,
    stats,
    topArtist: me.topArtists[0] ?? null,
    topTrack: me.topTracks[0] ?? null,
    peakHour,
    listeningHours: hours,
  };
}
