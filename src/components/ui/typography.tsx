import { cn } from '@/lib/utils';
import * as React from 'react';

import { Text } from '@/components/ui/text';

type TextProps = React.ComponentProps<typeof Text>;

/** Fraunces — editorial serif. Headlines, scores, the flirty accent (use `italic`). */
function Display({ className, italic, ...props }: TextProps & { italic?: boolean }) {
  return (
    <Text
      className={cn(
        'text-3xl text-foreground',
        italic ? 'font-display-italic italic' : 'font-display',
        className
      )}
      {...props}
    />
  );
}

/** Geist — body/UI. Everything functional. Sentence case, never all caps. */
function Body({ className, ...props }: TextProps) {
  return <Text className={cn('font-body text-base text-foreground', className)} {...props} />;
}

/** Geist Mono — data/labels. Scores, percentages, metadata: uppercase, wide tracking. */
function Mono({ className, ...props }: TextProps) {
  return (
    <Text
      className={cn(
        'font-mono text-xs uppercase tracking-widest text-muted-foreground',
        className
      )}
      {...props}
    />
  );
}

export { Display, Body, Mono };
export type { TextProps as TypographyProps };
