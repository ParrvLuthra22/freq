import { LinearGradient } from 'expo-linear-gradient';

import { Display } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

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
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className={cn('items-center justify-center', className)}
      style={{ width: size, height: size, borderRadius: size / 2 }}>
      <Display className={`text-[${Math.round(size * 0.4)}px] leading-none text-ivory`}>
        {initial}
      </Display>
    </LinearGradient>
  );
}

export { Avatar };
export type { AvatarProps };
