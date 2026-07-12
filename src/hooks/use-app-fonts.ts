import { Fraunces_400Regular } from '@expo-google-fonts/fraunces/400Regular';
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import { Fraunces_500Medium_Italic } from '@expo-google-fonts/fraunces/500Medium_Italic';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_600SemiBold_Italic } from '@expo-google-fonts/fraunces/600SemiBold_Italic';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono/400Regular';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono/500Medium';
import { useFonts } from 'expo-font';

// Import from each weight's submodule (not the package barrel) so Metro only
// bundles the specific .ttf files we use, not all 17 weights per family.
export function useAppFonts() {
  return useFonts({
    Fraunces: Fraunces_400Regular,
    'Fraunces-Medium': Fraunces_500Medium,
    'Fraunces-SemiBold': Fraunces_600SemiBold,
    'Fraunces-Italic': Fraunces_500Medium_Italic,
    'Fraunces-SemiBold-Italic': Fraunces_600SemiBold_Italic,
    Geist: Geist_400Regular,
    'Geist-Medium': Geist_500Medium,
    'Geist-SemiBold': Geist_600SemiBold,
    GeistMono: GeistMono_400Regular,
    'GeistMono-Medium': GeistMono_500Medium,
  });
}
