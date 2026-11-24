import type { TextStyle, ViewStyle } from 'react-native';

/**
 * Nele design tokens — derived from `DESIGN.md` (Airbnb-inspired system).
 *
 * Rules worth keeping in mind while building screens:
 * - White canvas, near-black ink, exactly one accent: Rausch (`colors.primary`).
 * - Soft shapes only: 8px buttons, 14px cards, pill search bar.
 * - One shadow tier. Depth comes from photography, not layered shadows.
 */
export const colors = {
  primary: '#ff385c',
  primaryActive: '#e00b41',
  primaryDisabled: '#ffd1da',
  primarySoft: '#fff1f4',
  ink: '#222222',
  body: '#3f3f3f',
  muted: '#6a6a6a',
  mutedSoft: '#929292',
  hairline: '#dddddd',
  hairlineSoft: '#ebebeb',
  borderStrong: '#c1c1c1',
  canvas: '#ffffff',
  surfaceSoft: '#f7f7f7',
  surfaceStrong: '#f2f2f2',
  onPrimary: '#ffffff',
  error: '#c13515',
  scrim: 'rgba(0, 0, 0, 0.5)',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  section: 64,
} as const;

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 32,
  full: 9999,
} as const;

export const typography = {
  displayXL: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  displayLG: { fontSize: 24, lineHeight: 30, fontWeight: '600', letterSpacing: -0.4 },
  displayMD: { fontSize: 21, lineHeight: 28, fontWeight: '600' },
  displaySM: { fontSize: 20, lineHeight: 26, fontWeight: '600', letterSpacing: -0.2 },
  titleMD: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  titleSM: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  cardTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  cardMeta: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  bodyMD: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodySM: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 14, lineHeight: 18, fontWeight: '500' },
  captionSM: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  badge: { fontSize: 11, lineHeight: 13, fontWeight: '600' },
  buttonMD: { fontSize: 16, lineHeight: 20, fontWeight: '500' },
  buttonSM: { fontSize: 14, lineHeight: 18, fontWeight: '500' },
} satisfies Record<string, TextStyle>;

/** The single elevation tier in the system. */
export const shadow: ViewStyle = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
};

export const hairline = { borderWidth: 1, borderColor: colors.hairline } as const;

/** Minimum touch target per the design spec. */
export const touchTarget = 48;

export const NELE = {
  name: 'Nele',
  tagline: 'Buy. Rent. Belong.',
} as const;
