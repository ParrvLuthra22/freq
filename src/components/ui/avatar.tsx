import { LinearGradient } from 'expo-linear-gradient';

import { Display } from '@/components/ui/typography';

type AvatarProps = {
  name: string;
  gradient: [string, string];
  size?: number;
  className?: string;
};

/** On-brand gradient placeholder avatar — no real faces. */
function Avatar({ name, gradient, size = 64, className }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase();

  return (
    // LinearGradient is a third-party native component — NativeWind drops its
    // className styles whenever a style prop is also present, so alignment and
    // sizing both have to travel through style (see onboarding-step.tsx).
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Display style={{ fontSize: Math.round(size * 0.4) }} className="leading-none text-ivory">
        {initial}
      </Display>
    </LinearGradient>
  );
}

export { Avatar };
export type { AvatarProps };
