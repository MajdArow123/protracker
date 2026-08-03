import { createContext, useContext } from 'react';

interface ThemeContextType {
  isDark: boolean;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
