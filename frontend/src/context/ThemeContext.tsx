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
  primary: '#B94CFF', // Neon orchid
  secondary: '#25D6FF', 
  tertiary: '#33FFB7', // Online glow
  background: '#05000D',
  bubbleSentBg: 'rgba(115, 66, 168, 0.42)',
  bubbleReceivedBg: 'rgba(18, 8, 42, 0.58)',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#A1A1A1',
  lightGray: 'rgba(255, 255, 255, 0.05)',
  text: '#FFFFFF',
  gradientPrimary: ['#210044', '#0B0620', '#020006'],
  gradientSecondary: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.3)', 'rgba(167,64,255,0.26)', 'rgba(255,255,255,0.08)'],
  glassBorder: 'rgba(255, 255, 255, 0.15)',
  borderWidth: StyleSheet.hairlineWidth,
  glassOpacity: 0.16,
  glassBlur: 40,
  radius: {
    pill: 999,
    panel: 40,
    card: 20,
    bubble: 20,
    story: 999 // Perfect circles for Obsidian
  }
};

const mochaTheme: ThemeColors = {
  primary: '#FF7A5C', // Living coral
  secondary: '#FF3B86', 
  tertiary: '#FFD36E', 
  background: '#09010C', // Warm plum espresso
  bubbleSentBg: 'rgba(126, 57, 126, 0.42)', // Glass dark
  bubbleReceivedBg: 'rgba(26, 8, 32, 0.58)', // Glass frosted
  white: 'rgba(255, 255, 255, 0.8)',
  black: '#100D0C',
  gray: 'rgba(255, 255, 255, 0.5)',
  lightGray: 'rgba(255, 255, 255, 0.05)',
  text: '#FDF7F2',
  gradientPrimary: ['#2C0B32', '#0B0614', '#020006'], // Warm depth gradient
  gradientSecondary: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.28)', 'rgba(255,89,170,0.24)', 'rgba(255,255,255,0.08)'],
  glassBorder: 'rgba(255, 255, 255, 0.15)',
  borderWidth: StyleSheet.hairlineWidth,
  glassOpacity: 0.1,
  glassBlur: 40, // Strong glass frosted
  radius: {
    pill: 30,
    panel: 40,
    card: 24,
    bubble: 18,
    story: 18 // Rounded squares for Mocha
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
  toggleTheme: () => {},
  colors: obsidianTheme,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('obsidian');

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === 'obsidian' ? 'mocha' : 'obsidian'));
  };

  const colors = themeMode === 'obsidian' ? obsidianTheme : mochaTheme;
  const isDark = true; // Both are technically "dark mode" conceptual designs

  return (
    <ThemeContext.Provider value={{ themeMode, isDark, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
