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
  primary: '#476F9B', // Deep Sky Blue (Accent)
  secondary: '#7FA5C2', // Soft Blue
  tertiary: '#A9C3D6', // Light Sky
  background: '#D0DFE9', // Main Background (Darker Light Mode)
  bubbleSentBg: 'rgba(71, 111, 155, 0.24)',
  bubbleReceivedBg: 'rgba(127, 165, 194, 0.32)',
  white: '#D0DFE9',
  black: '#000000',
  gray: 'rgba(48, 80, 113, 0.78)',
  lightGray: 'rgba(15, 43, 76, 0.12)',
  text: '#112D4E', // Deep Navy for high contrast
  gradientPrimary: ['#D0DFE9', '#B8CEDD', '#8FB1C8', '#C7D9E5'], 
  gradientSecondary: ['rgba(71, 111, 155, 0.44)', 'rgba(127, 165, 194, 0.4)', 'rgba(169, 195, 214, 0.34)'],
  glassBorder: 'rgba(48, 80, 113, 0.34)',
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
