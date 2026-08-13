// expo-router v6 (SDK 54) does not re-export the navigation themes; v7 does.
// Importing from the source package works on both.
import { DarkTheme, DefaultTheme } from '@react-navigation/native';

export const THEME = {
  light: {
    background: '#F1E8DB',
    foreground: '#171310',
    card: '#F8F1E6',
    cardForeground: '#171310',
    popover: '#F8F1E6',
    popoverForeground: '#171310',
    primary: '#C67E6F',
    primaryForeground: '#F1E8DB',
    secondary: '#F8F1E6',
    secondaryForeground: '#171310',
    muted: '#F8F1E6',
    mutedForeground: '#726A5E',
    accent: '#9C7C4E',
    accentForeground: '#F1E8DB',
    destructive: '#C67E6F',
    border: '#726A5E',
    input: '#726A5E',
    ring: '#C67E6F',
    radius: '0.75rem',
  },
  dark: {
    background: '#100F0D',
    foreground: '#F3ECE1',
    card: '#1B1815',
    cardForeground: '#F3ECE1',
    popover: '#1B1815',
    popoverForeground: '#F3ECE1',
    primary: '#E6A99E',
    primaryForeground: '#100F0D',
    secondary: '#1B1815',
    secondaryForeground: '#F3ECE1',
    muted: '#1B1815',
    mutedForeground: '#8B857A',
    accent: '#C9B79C',
    accentForeground: '#100F0D',
    destructive: '#C67E6F',
    border: '#8B857A',
    input: '#8B857A',
    ring: '#E6A99E',
    radius: '0.75rem',
  },
};

export const NAV_THEME: Record<'light' | 'dark', typeof DefaultTheme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
    fonts: {
      regular: { fontFamily: 'Geist', fontWeight: '400' },
      medium: { fontFamily: 'Geist-Medium', fontWeight: '500' },
      bold: { fontFamily: 'Geist-Medium', fontWeight: '500' },
      heavy: { fontFamily: 'Geist-SemiBold', fontWeight: '600' },
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
    fonts: {
      regular: { fontFamily: 'Geist', fontWeight: '400' },
      medium: { fontFamily: 'Geist-Medium', fontWeight: '500' },
      bold: { fontFamily: 'Geist-Medium', fontWeight: '500' },
      heavy: { fontFamily: 'Geist-SemiBold', fontWeight: '600' },
    },
  },
};
