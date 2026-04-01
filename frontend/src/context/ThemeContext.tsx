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
  primary: '#7D5CFF', // Electric Violet
  secondary: '#FF4B4B', 
  tertiary: '#FF734E', // Orange notification badge
  background: '#0B0B0B',
  bubbleSentBg: '#1A1A1A',
  bubbleReceivedBg: '#7D5CFF',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#A1A1A1',
  lightGray: 'rgba(255, 255, 255, 0.05)',
  text: '#FFFFFF',
  gradientPrimary: ['#0B0B0B', '#0B0B0B', '#0B0B0B'],
  gradientSecondary: ['#7D5CFF', '#5C3CFF'],
  glassBorder: 'transparent', // Solid, no glass borders
  borderWidth: 0,
  glassOpacity: 1, // Opaque layers
  glassBlur: 0, // No blur
  radius: {
    pill: 999,
    panel: 40,
    card: 20,
    bubble: 20,
    story: 999 // Perfect circles for Obsidian
  }
};

const mochaTheme: ThemeColors = {
  primary: '#FF6B4A', // Living coral
  secondary: '#FF3B30', 
  tertiary: '#FF6B4A', 
  background: '#1E1B1B', // Base warm espresso
  bubbleSentBg: 'rgba(0, 0, 0, 0.4)', // Glass dark
  bubbleReceivedBg: 'rgba(255, 255, 255, 0.1)', // Glass frosted
  white: 'rgba(255, 255, 255, 0.8)',
  black: '#100D0C',
  gray: 'rgba(255, 255, 255, 0.5)',
  lightGray: 'rgba(255, 255, 255, 0.05)',
  text: '#FDF7F2',
  gradientPrimary: ['#302624', '#1E1B1A', '#0A0909'], // Warm depth gradient
  gradientSecondary: ['#FF6B4A', '#D24119'],
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  borderWidth: StyleSheet.hairlineWidth,
  glassOpacity: 0.1,
  glassBlur: 15, // Medium glass frosted
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
