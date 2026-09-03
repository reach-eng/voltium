/**
 * Voltium Design Tokens (PR-125 / DS-T-4 / PR-P3.5)
 * Source of truth: <root>/design-tokens.json
 *
 * Exposes strongly-typed tokens for web components, synchronizing
 * styling constants with the Voltium design system.
 */

export const PRIMITIVE_COLORS = {
  blue500: '#0053C1',
  slate900: '#0F172A',
  slate500: '#64748B',
  emerald500: '#10B981',
  amber500: '#F59E0B',
  rose500: '#EF4444',
} as const;

export const SEMANTIC_COLORS = {
  light: {
    actionPrimary: '#0053C1',
    statusInfo: '#3B82F6',
    statusNeutral: '#64748B',
    statusSuccess: '#10B981',
    statusWarning: '#F59E0B',
    statusError: '#EF4444',
  },
  dark: {
    actionPrimary: '#0053C1',
    statusInfo: '#60A5FA',
    statusNeutral: '#94A3B8',
    statusSuccess: '#34D399',
    statusWarning: '#FBBF24',
    statusError: '#FCA5A5',
  },
} as const;

export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const RADII = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
} as const;

export const SHADOWS = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
} as const;

export const TYPOGRAPHY = {
  displayLarge: { fontSize: 40, fontWeight: 800, letterSpacing: -1.0 },
  displayMedium: { fontSize: 32, fontWeight: 800, letterSpacing: -0.8 },
  headingLarge: { fontSize: 28, fontWeight: 800, letterSpacing: -0.5 },
  headingMedium: { fontSize: 24, fontWeight: 800, letterSpacing: -0.4 },
  headingSmall: { fontSize: 20, fontWeight: 800, letterSpacing: -0.3 },
  titleLarge: { fontSize: 18, fontWeight: 700, letterSpacing: -0.2 },
  titleMedium: { fontSize: 16, fontWeight: 700, letterSpacing: -0.1 },
  titleSmall: { fontSize: 14, fontWeight: 700, letterSpacing: 0 },
  bodyLarge: { fontSize: 16, fontWeight: 500, letterSpacing: 0 },
  bodyMedium: { fontSize: 14, fontWeight: 500, letterSpacing: 0 },
  bodySmall: { fontSize: 12, fontWeight: 500, letterSpacing: 0 },
  labelLarge: { fontSize: 14, fontWeight: 600, letterSpacing: 0 },
  labelMedium: { fontSize: 12, fontWeight: 600, letterSpacing: 0 },
  labelSmall: { fontSize: 11, fontWeight: 600, letterSpacing: 0 },
  overline: { fontSize: 10, fontWeight: 800, letterSpacing: 1.0 },
  otpDigit: { fontSize: 24, fontWeight: 700, letterSpacing: 0 },
  priceDisplay: { fontSize: 22, fontWeight: 800, letterSpacing: 0 },
  codeMedium: { fontSize: 14, fontWeight: 500, letterSpacing: 0, fontFamily: 'JetBrains Mono' },
  codeLarge: { fontSize: 16, fontWeight: 600, letterSpacing: 0.5, fontFamily: 'JetBrains Mono' },
} as const;

export const DESIGN_TOKENS = {
  name: 'Voltium Design System Tokens',
  version: '1.0.0',
  tokens: {
    colors: {
      primitive: PRIMITIVE_COLORS,
      semantic: SEMANTIC_COLORS,
    },
    spacing: SPACING,
    radii: RADII,
    shadows: SHADOWS,
    typography: TYPOGRAPHY,
  },
} as const;
