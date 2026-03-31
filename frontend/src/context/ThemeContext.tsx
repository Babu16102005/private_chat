import { createContext, useState, useContext, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark';

interface ThemeColors {
  primary: string;
  secondary: string;
  tertiary: string;
  background: string;
  text: string;
  white: string;
  lightGray: string;
  gray: string;
}

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  colors: ThemeColors;
}

const lightColors: ThemeColors = {
  primary: '#E91E63',
  secondary: '#F48FB1',
  tertiary: '#4FC3F7',
  background: '#FCE4EC',
  text: '#4E342E',
  white: '#FFFFFF',
  lightGray: '#F5F5F5',
  gray: '#BDBDBD'
};

const darkColors: ThemeColors = {
  primary: '#EC407A',
  secondary: '#F48FB1',
  tertiary: '#4FC3F7',
  background: '#1E1E1E',
  text: '#FFFFFF',
  white: '#2D2D2D',
  lightGray: '#3D3D3D',
  gray: '#9E9E9E'
};

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  toggleTheme: () => {},
  colors: lightColors
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const saved = await AsyncStorage.getItem('theme_mode');
      if (saved === 'dark') setIsDark(true);
      else if (saved === 'light') setIsDark(false);
      else {
        const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
        setIsDark(prefersDark ?? false);
      }
    } catch (e) {}
  };

  const toggleTheme = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    AsyncStorage.setItem('theme_mode', newMode ? 'dark' : 'light');
  };

  const colors = useMemo(() => isDark ? darkColors : lightColors, [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
export { lightColors, darkColors };
