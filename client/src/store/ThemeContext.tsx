import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactElement,
  type ReactNode,
} from 'react';

export type ThemeMode = 'dark' | 'light';

export interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'corpverse_theme';

export function ThemeProvider({ children }: { children: ReactNode }): ReactElement {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved === 'dark' || saved === 'light') return saved;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
          return 'light';
        }
      }
    } catch {
      // Fallback if localStorage is inaccessible
    }
    return 'dark';
  });

  useEffect(() => {
    try {
      if (typeof document !== 'undefined') {
        const root = document.documentElement;
        root.classList.remove('theme-dark', 'theme-light');
        root.classList.add(`theme-${theme}`);
      }
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, theme);
      }
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  const toggleTheme = (): void => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme: ThemeMode): void => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeProvider;
