import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEMES, type Theme } from '@ap/shared-constants';
import { tokens, type ColorThemeTokens } from '@ap/design-tokens';

const THEME_STORAGE_KEY = 'ap_driver_theme';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  colors: ColorThemeTokens;
  setTheme: (theme: Theme) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function MobileThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<Theme>(THEMES.SYSTEM);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === THEMES.LIGHT || saved === THEMES.DARK || saved === THEMES.SYSTEM) {
        setThemeState(saved);
      }
    });
  }, []);

  const resolvedTheme = useMemo<'light' | 'dark'>(() => {
    if (theme === THEMES.SYSTEM) {
      return systemScheme === 'dark' ? 'dark' : 'light';
    }
    return theme === THEMES.DARK ? 'dark' : 'light';
  }, [theme, systemScheme]);

  const colors = useMemo<ColorThemeTokens>(() => {
    return resolvedTheme === 'dark' ? tokens.colors.dark : tokens.colors.light;
  }, [resolvedTheme]);

  const setTheme = async (newTheme: Theme) => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
    setThemeState(newTheme);
  };

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      colors,
      setTheme,
    }),
    [theme, resolvedTheme, colors],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useMobileTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useMobileTheme must be used within a MobileThemeProvider');
  }
  return context;
}
