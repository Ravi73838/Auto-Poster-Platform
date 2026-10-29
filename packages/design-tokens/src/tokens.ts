export interface ColorThemeTokens {
  background: string;
  surface: string;
  surfaceAlt: string;
  textPrimary: string;
  textSecondary: string;
  primary: string;
  primaryText: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
}

export const lightColors: ColorThemeTokens = {
  background: '#FFFFFF',
  surface: '#F7F9FC',
  surfaceAlt: '#EEF2F6',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  primary: '#2E5597',
  primaryText: '#FFFFFF',
  border: '#E5E7EB',
  success: '#15803D',
  warning: '#B45309',
  danger: '#B91C1C',
  info: '#1D4ED8',
};

export const darkColors: ColorThemeTokens = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceAlt: '#334155',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  primary: '#7AA2F7',
  primaryText: '#0F172A',
  border: '#334155',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#38BDF8',
};

export const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
} as const;

export const radius = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

export const typography = {
  fontFamily: {
    sans: 'Inter, "Noto Sans Devanagari", "Noto Sans Gujarati", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  fontSize: {
    xs: ['12px', '16px'],
    sm: ['14px', '20px'],
    base: ['16px', '24px'],
    lg: ['18px', '28px'],
    xl: ['20px', '28px'],
    '2xl': ['24px', '32px'],
    '3xl': ['30px', '36px'],
  },
} as const;

export const tokens = {
  colors: {
    light: lightColors,
    dark: darkColors,
  },
  spacing,
  radius,
  typography,
} as const;

export function toCssVariables(theme: 'light' | 'dark'): Record<string, string> {
  const activeColors = theme === 'light' ? lightColors : darkColors;
  const vars: Record<string, string> = {};

  (Object.keys(activeColors) as (keyof ColorThemeTokens)[]).forEach((key) => {
    vars[`--color-${key}`] = activeColors[key];
  });

  return vars;
}
