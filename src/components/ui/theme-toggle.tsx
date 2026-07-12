import { useColorScheme } from 'nativewind';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

type ThemeToggleProps = {
  className?: string;
};

/** Swaps the whole app between FREQ's dark (default) and cream palettes. */
function ThemeToggle({ className }: ThemeToggleProps) {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Button variant="outline" onPress={toggleColorScheme} className={className}>
      <Text>{isDark ? 'Switch to cream' : 'Switch to dark'}</Text>
    </Button>
  );
}

export { ThemeToggle };
export type { ThemeToggleProps };
