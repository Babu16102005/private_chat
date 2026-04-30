import React, { createContext, useContext, useState } from 'react';
import { StyleSheet } from 'react-native';

export type ThemeMode = 'obsidian' | 'mocha';

export interface ThemeColors {
  primary: string;
  secondary: string;
  tertiary: string;
  background: string;
  bubbleSentBg: string; // Specific for sent bubbles
  bubbleReceivedBg: string; // Specific for received bubbles
  white: string;
  black: string;
  gray: string;
  lightGray: string;
  text: string;
  gradientPrimary: readonly [string, string, ...string[]];
  gradientSecondary: readonly [string, string, ...string[]];
  glassBorder: string;
  borderWidth: number;
  glassOpacity: number;
  glassBlur: number;
  radius: {
    pill: number;
    panel: number;
    card: number;
    bubble: number;
    story: number;
  };
}

const obsidianTheme: ThemeColors = {
  primary: '#E9C7FF',
  secondary: '#64F3FF',
  tertiary: '#8DFFD5',
  background: '#050712',
  bubbleSentBg: 'rgba(255, 255, 255, 0.12)',
  bubbleReceivedBg: 'rgba(255, 255, 255, 0.06)',
  white: '#FFFFFF',
  black: '#000000',
  gray: 'rgba(234, 244, 255, 0.66)',
  lightGray: 'rgba(255, 255, 255, 0.055)',
  text: '#F8FBFF',
  gradientPrimary: ['#101B38', '#060A19', '#182450', '#050712'],
  gradientSecondary: ['rgba(255,255,255,0.36)', 'rgba(100,243,255,0.34)', 'rgba(233,199,255,0.36)', 'rgba(141,255,213,0.22)'],
  glassBorder: 'rgba(255, 255, 255, 0.18)',
  borderWidth: 0.5,
  glassOpacity: 0.12,
  glassBlur: 80,
  radius: {
    pill: 999,
    panel: 40,
    card: 20,
    bubble: 20,
    story: 999
  }
};

const mochaTheme: ThemeColors = {
  primary: '#769FCD', // Deep Sky Blue (Accent)
  secondary: '#B9D7EA', // Soft Blue
  tertiary: '#D6E6F2', // Light Sky
  background: '#F7FBFC', // Main Background (Ultra Light)
  bubbleSentBg: 'rgba(118, 159, 205, 0.14)',
  bubbleReceivedBg: 'rgba(185, 215, 234, 0.18)',
  white: '#F7FBFC',
  black: '#000000',
  gray: 'rgba(118, 159, 205, 0.65)',
  lightGray: 'rgba(0, 0, 0, 0.04)',
  text: '#112D4E', // Deep Navy for high contrast
  gradientPrimary: ['#F7FBFC', '#D6E6F2', '#B9D7EA', '#F7FBFC'], 
  gradientSecondary: ['rgba(118, 159, 205, 0.3)', 'rgba(185, 215, 234, 0.25)', 'rgba(214, 230, 242, 0.2)'],
  glassBorder: 'rgba(118, 159, 205, 0.2)',
  borderWidth: 0.8,
  glassOpacity: 0.05,
  glassBlur: 40,
  radius: {
    pill: 999,
    panel: 40,
    card: 24,
    bubble: 20,
    story: 999
  }
};

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean; // Retained for backwards compatibility in components
  toggleTheme: () => void;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'obsidian',
  isDark: true,
  toggleTheme: () => { },
  colors: obsidianTheme,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('obsidian');

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === 'obsidian' ? 'mocha' : 'obsidian'));
  };

  const colors = themeMode === 'obsidian' ? obsidianTheme : mochaTheme;
  const isDark = themeMode === 'obsidian';

  return (
    <ThemeContext.Provider value={{ themeMode, isDark, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
