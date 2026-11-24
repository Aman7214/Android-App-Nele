import { useWindowDimensions } from 'react-native';

import { spacing } from './tokens';

/**
 * Breakpoints are tuned to content, not device names:
 *
 * - `compact`  < 360dp — Galaxy Fold cover screen, 320-class phones, split screen
 * - `regular`  360–599 — the vast majority of Android phones (360dp is the baseline)
 * - `wide`     600–899 — large phones, unfolded foldables, small tablets
 * - `tablet`   >= 900  — tablets, desktop web
 */
export const breakpoints = { compact: 360, wide: 600, tablet: 900 } as const;

export type LayoutTier = 'compact' | 'regular' | 'wide' | 'tablet';

export type Layout = {
  width: number;
  height: number;
  tier: LayoutTier;
  isCompact: boolean;
  /** Two columns up to `wide`, three above. */
  gridColumns: number;
  /** Horizontal page gutter for this tier. */
  gutter: number;
  /** `null` on phones; a number centres content on big screens. */
  maxContentWidth: number | null;
  /** Display size that still fits a 320dp screen without a ragged line break. */
  displaySize: { fontSize: number; lineHeight: number };
  /** Onboarding photo height, clamped so short phones keep the CTA visible. */
  mediaHeight: number;
};

export function getLayout(width: number, height: number): Layout {
  const tier: LayoutTier =
    width < breakpoints.compact
      ? 'compact'
      : width < breakpoints.wide
        ? 'regular'
        : width < breakpoints.tablet
          ? 'wide'
          : 'tablet';

  return {
    width,
    height,
    tier,
    isCompact: tier === 'compact',
    gridColumns: tier === 'wide' || tier === 'tablet' ? 3 : 2,
    gutter: tier === 'wide' ? spacing.lg : tier === 'tablet' ? spacing.xl : spacing.base,
    maxContentWidth: tier === 'tablet' ? 880 : tier === 'wide' ? 720 : null,
    displaySize:
      tier === 'compact'
        ? { fontSize: 24, lineHeight: 30 }
        : { fontSize: 28, lineHeight: 34 },
    mediaHeight: Math.round(Math.min(Math.max(height * 0.42, 240), 440)),
  };
}

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  return getLayout(width, height);
}
