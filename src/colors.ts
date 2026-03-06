// Dracula dark theme palette
const DarkColors = {
  SUCCESS: '#50fa7b',
  ERROR: '#ff5555',
  WARNING: '#ffb86c',
  INFO: '#8be9fd',
  NEUTRAL: '#bd93f9',
  SUPPORTING: '#8c9ac4',
  ACCENT: '#ff79c6',

  PRIMARY: '#f8f8f2',
  SECONDARY: '#f1fa8c',
  DIM: '#6272a4',

  BACKGROUND: '#282a36',
  BACKGROUND_ALT: '#1e1f29',
  SELECTED: '#191a21',
  STRIPE: '#343746',
  TRACK: '#44475a',

  BADGE_SUCCESS_BG: '#1a4a1a',
  BADGE_ACCENT_BG: '#3a1a2a',
  BADGE_WARNING_BG: '#4a2a00',
  BADGE_INFO_BG: '#003a4a',
} as const;

// Light theme palette
const LightColors = {
  SUCCESS: '#1a7f37',
  ERROR: '#cf222e',
  WARNING: '#9a6700',
  INFO: '#0969da',
  NEUTRAL: '#8250df',
  SUPPORTING: '#656d76',
  ACCENT: '#bf3989',

  PRIMARY: '#1f2328',
  SECONDARY: '#7d5600',
  DIM: '#8b949e',

  BACKGROUND: '#ffffff',
  BACKGROUND_ALT: '#f6f8fa',
  SELECTED: '#ddf4ff',
  STRIPE: '#f0f0f0',
  TRACK: '#d0d7de',

  BADGE_SUCCESS_BG: '#dafbe1',
  BADGE_ACCENT_BG: '#ffeff7',
  BADGE_WARNING_BG: '#fff8c5',
  BADGE_INFO_BG: '#ddf4ff',
} as const;

export type ColorScheme = 'dark' | 'light';
export type ColorPalette = { -readonly [K in keyof typeof DarkColors]: string };

// Mutable palette — mutated in place via setColorScheme so all
// render-time reads of Colors.X pick up the current theme.
export const Colors: ColorPalette = { ...DarkColors };

export const setColorScheme = (scheme: ColorScheme): void => {
  Object.assign(Colors, scheme === 'dark' ? DarkColors : LightColors);
};

export const getColorScheme = (): ColorScheme =>
  Colors.BACKGROUND === DarkColors.BACKGROUND ? 'dark' : 'light';

// Determine scheme from a terminal background hex (#rrggbb) via luminance.
export const detectSchemeFromBackground = (hex: string | null): ColorScheme => {
  if (!hex) return 'dark';
  const match = hex.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
  if (!match) return 'dark';
  const [r, g, b] = [match[1]!, match[2]!, match[3]!].map(h => parseInt(h, 16));
  const luminance = 0.299 * r! + 0.587 * g! + 0.114 * b!;
  return luminance < 128 ? 'dark' : 'light';
};
