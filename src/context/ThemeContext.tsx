import React, { useState, useEffect, useCallback } from 'react';
import { ThemeContext, type Theme, type ThemeContextType, useTheme } from './useTheme';

export { useTheme, type Theme, type ThemeContextType };

const THEME_STORAGE_KEY = 'topcoin_app_theme';

const applyThemeToDOM = (t: Theme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  // In Tailwind darkMode: 'class', class 'dark' MUST strictly belong on <html> ONLY.
  // We explicitly clean up body to prevent descendant selector leakage.
  if (document.body) {
    document.body.classList.remove('dark');
  }

  if (t === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

const getSavedTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // fallback
  }
  return 'dark'; // Default dark
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(getSavedTheme);

  // Sync on mount & state updates
  useEffect(() => {
    applyThemeToDOM(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Direct, instantaneous switch
  const setTheme = useCallback((next: Theme) => {
    applyThemeToDOM(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore
    }
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      applyThemeToDOM(next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
