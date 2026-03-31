import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme, StyleSheet } from 'react-native';

type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  primary: string;
  secondary: string;
  tertiary: string; // Amber accent
  background: string;
  white: string;
  black: string;
  gray: string;
  lightGray: string;
  text: string;
  gradientPrimary: readonly [string, string, ...string[]]; // Mesh/Amber
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

const darkColors: ThemeColors = {
  primary: '#D27619', // Deep Amber
  secondary: '#FF3B30', // Alert Red
  tertiary: '#FFA500', // Bright Amber
  background: '#000000',
  white: 'rgba(255, 255, 255, 0.08)',
  black: '#1A120B', // Deep Brown
  gray: '#A1A1A1',
  lightGray: 'rgba(255, 255, 255, 0.05)',
  text: '#FFFFFF',
  gradientPrimary: ['#1A120B', '#2D1E12', '#000000'], // Mesh theme
  gradientSecondary: ['#FF3B30', '#D27619'],
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  borderWidth: StyleSheet.hairlineWidth,
  glassOpacity: 0.1,
  glassBlur: 30, // High intensity glass
  radius: {
    pill: 999,
    panel: 40,
    card: 32,
    bubble: 20,
    story: 16 // Rounded squares
  }
};

const lightColors: ThemeColors = {
  ...darkColors,
  background: '#FDF7F2',
  white: 'rgba(255, 255, 255, 0.7)',
  black: '#2D1E12',
  text: '#1A120B',
  glassBorder: 'rgba(0,0,0,0.05)',
  glassOpacity: 0.2
};

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  toggleTheme: () => {},
  colors: darkColors,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    setIsDark(systemScheme === 'dark');
  }, [systemScheme]);

  const toggleTheme = () => setIsDark(!isDark);
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
