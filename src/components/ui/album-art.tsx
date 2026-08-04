import * as React from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

/**
 * Procedural album art, deterministic per person.
 *
 * FREQ is about what people play, not how they photograph, so profiles carry a
 * record sleeve rather than a face. Every mark is drawn from the brand palette
 * and derived from a seed string, so the same person always gets the same art
 * and no image assets ship with the app.
 */

/** Brand duotones. Ordered so the first colour always carries the composition. */
const PALETTES: [string, string, string][] = [
  ['#E6A99E', '#100F0D', '#C9B79C'], // signal on ink, champagne accent
  ['#C9B79C', '#1B1815', '#E6A99E'], // champagne on charcoal
  ['#8B857A', '#100F0D', '#F3ECE1'], // ash on ink, ivory accent
  ['#F3ECE1', '#1B1815', '#E6A99E'], // ivory on charcoal
  ['#E6A99E', '#1B1815', '#8B857A'],
  ['#C9B79C', '#100F0D', '#F3ECE1'],
];

const MOTIFS = ['grooves', 'horizon', 'arcs', 'prism', 'bars'] as const;
type Motif = (typeof MOTIFS)[number];

/** xmur3 — string to a well-mixed 32-bit seed. */
function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** mulberry32 — small deterministic PRNG, plenty for layout jitter. */
function makeRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Grooves({ fg, accent, rand }: { fg: string; accent: string; rand: () => number }) {
  // Off-centre so the grooves read as a record caught mid-spin.
  const cx = 38 + rand() * 24;
  const cy = 38 + rand() * 24;
  const rings = 5 + Math.floor(rand() * 4);

  return (
    <G>
      {Array.from({ length: rings }, (_, i) => (
        <Circle
          key={i}
          cx={cx}
          cy={cy}
          r={8 + i * (46 / rings)}
          stroke={i % 3 === 0 ? accent : fg}
          strokeWidth={i % 3 === 0 ? 2.5 : 1.25}
          fill="none"
          opacity={Math.max(0.58, 0.95 - i * 0.06)}
        />
      ))}
      <Circle cx={cx} cy={cy} r={4} fill={accent} />
    </G>
  );
}

function Horizon({ fg, accent, rand }: { fg: string; accent: string; rand: () => number }) {
  const sunY = 34 + rand() * 22;
  const sunR = 16 + rand() * 10;

  return (
    <G>
      <Circle cx={50} cy={sunY} r={sunR} fill={fg} opacity={0.95} />
      {Array.from({ length: 5 }, (_, i) => (
        <Rect
          key={i}
          x={0}
          y={sunY + sunR - 6 + i * 9}
          width={100}
          height={3 + i * 0.8}
          fill={i % 2 === 0 ? accent : fg}
          opacity={Math.max(0.42, 0.75 - i * 0.07)}
        />
      ))}
    </G>
  );
}

function Arcs({ fg, accent, rand }: { fg: string; accent: string; rand: () => number }) {
  // Anchor the sweep to one corner so the arcs feel like they continue past the frame.
  const flip = rand() > 0.5;
  const ox = flip ? 100 : 0;

  return (
    <G>
      {Array.from({ length: 6 }, (_, i) => {
        const r = 22 + i * 15;
        const sweep = flip ? 0 : 1;
        return (
          <Path
            key={i}
            d={`M ${ox} ${100 - r} A ${r} ${r} 0 0 ${sweep} ${flip ? ox - r : r} 100`}
            stroke={i % 2 === 0 ? fg : accent}
            strokeWidth={i % 2 === 0 ? 3 : 1.5}
            fill="none"
            opacity={Math.max(0.62, 1 - i * 0.08)}
          />
        );
      })}
    </G>
  );
}

function Prism({ fg, accent, rand }: { fg: string; accent: string; rand: () => number }) {
  const lean = rand() * 40 - 20;

  return (
    <G>
      {Array.from({ length: 6 }, (_, i) => {
        const x = i * 18 - 10;
        return (
          <Path
            key={i}
            d={`M ${x} 0 L ${x + 12} 0 L ${x + 12 + lean} 100 L ${x + lean} 100 Z`}
            fill={i % 3 === 0 ? accent : fg}
            opacity={0.45 + (i % 3) * 0.2}
          />
        );
      })}
    </G>
  );
}

function Bars({ fg, accent, rand }: { fg: string; accent: string; rand: () => number }) {
  const count = 9;
  return (
    <G>
      {Array.from({ length: count }, (_, i) => {
        const h = 18 + rand() * 62;
        const w = 100 / count;
        return (
          <Rect
            key={i}
            x={i * w + w * 0.18}
            y={(100 - h) / 2}
            width={w * 0.64}
            height={h}
            rx={w * 0.32}
            fill={i % 4 === 0 ? accent : fg}
            opacity={0.6 + (i % 3) * 0.18}
          />
        );
      })}
    </G>
  );
}

type AlbumArtProps = {
  /** Any stable string — a user id. The same seed always yields the same sleeve. */
  seed: string;
  size?: number;
  /** 'circle' for avatars, 'square' for sleeve-style hero art. */
  shape?: 'circle' | 'square';
  /**
   * Stretch to the container's width instead of a fixed size, staying square.
   * `size` sets pixels through an inline style, which NativeWind's className
   * cannot override — so filling a parent needs its own mode rather than a
   * `w-full` that silently loses.
   */
  fill?: boolean;
  className?: string;
};

function AlbumArt({ seed, size = 64, shape = 'circle', fill = false, className }: AlbumArtProps) {
  const { motif, fg, bg, accent, rand } = React.useMemo(() => {
    const h = hashSeed(seed);
    const random = makeRandom(h);
    const [f, b, a] = PALETTES[h % PALETTES.length];
    return {
      motif: MOTIFS[Math.floor(random() * MOTIFS.length)] as Motif,
      fg: f,
      bg: b,
      accent: a,
      rand: random,
    };
  }, [seed]);

  const radius = shape === 'circle' ? 50 : 12;
  const clipId = `clip-${hashSeed(seed)}`;

  return (
    <View
      className={className}
      style={fill ? { width: '100%', aspectRatio: 1 } : { width: size, height: size }}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <ClipPath id={clipId}>
            {shape === 'circle' ? (
              <Circle cx={50} cy={50} r={50} />
            ) : (
              <Rect x={0} y={0} width={100} height={100} rx={radius} />
            )}
          </ClipPath>
        </Defs>

        <G clipPath={`url(#${clipId})`}>
          <Rect x={0} y={0} width={100} height={100} fill={bg} />
          {motif === 'grooves' ? <Grooves fg={fg} accent={accent} rand={rand} /> : null}
          {motif === 'horizon' ? <Horizon fg={fg} accent={accent} rand={rand} /> : null}
          {motif === 'arcs' ? <Arcs fg={fg} accent={accent} rand={rand} /> : null}
          {motif === 'prism' ? <Prism fg={fg} accent={accent} rand={rand} /> : null}
          {motif === 'bars' ? <Bars fg={fg} accent={accent} rand={rand} /> : null}
        </G>

        {/* Several palettes use ink as their ground, which is also the page
            background — without an edge the artwork dissolves into the screen
            instead of reading as a sleeve. */}
        {shape === 'circle' ? (
          <Circle cx={50} cy={50} r={49.25} stroke={fg} strokeWidth={1.5} fill="none" opacity={0.35} />
        ) : (
          <Rect
            x={0.75}
            y={0.75}
            width={98.5}
            height={98.5}
            rx={radius}
            stroke={fg}
            strokeWidth={1.5}
            fill="none"
            opacity={0.35}
          />
        )}
      </Svg>
    </View>
  );
}

export { AlbumArt };
export type { AlbumArtProps };
