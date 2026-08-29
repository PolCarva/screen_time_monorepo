export const colors = {
  chalk: "#F1EFE8",
  chalkRaised: "#F8F6EF",
  graphite: "#242826",
  graphiteSoft: "#4E5451",
  mineral: "#697F8C",
  mineralLight: "#A7B5BA",
  peach: "#D39A83",
  fog: "#D9DEDC",
  white: "#FFFDF8",
  success: "#2F6B4A",
  warning: "#9A6A27",
  danger: "#A9473E",
  focus: "#315CBE",

  // Transitional semantic aliases. New components should use the names above.
  paper: "#F1EFE8",
  paperRaised: "#F8F6EF",
  ink: "#242826",
  inkSoft: "#4E5451",
  muted: "#4E5451",
  rule: "#D9DEDC",
  ruleStrong: "#A7B5BA",
  signal: "#697F8C",
  impact: "#D39A83",
  record: "#A7B5BA",
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 72,
  huge: 96,
} as const;

export const radius = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  control: 6,
  surface: 8,
  modal: 16,
  pill: 999,
} as const;

export const borders = { standard: 1, active: 2, emphasis: 4 } as const;
export const shadows = {
  none: "none",
  menu: "0 8px 24px rgba(36, 40, 38, 0.08)",
  modal: "0 20px 56px rgba(36, 40, 38, 0.14)",
} as const;
export const elevation = { base: 0, menu: 1, modal: 2 } as const;
export const breakpoints = { compact: 480, tablet: 768, desktop: 1024, wide: 1280 } as const;

export const fonts = {
  brand: "Recursive_400Regular",
  brandMedium: "Recursive_500Medium",
  brandSemiBold: "Recursive_600SemiBold",
  brandBold: "Recursive_700Bold",
  mono: "Recursive_400Regular",
  monoMedium: "Recursive_500Medium",
  monoSemiBold: "Recursive_600SemiBold",
} as const;

export const type = {
  display: { fontSize: 44, lineHeight: 44, letterSpacing: -1.8 },
  displaySmall: { fontSize: 32, lineHeight: 34, letterSpacing: -1 },
  heading: { fontSize: 24, lineHeight: 27, letterSpacing: -0.55 },
  bodyLarge: { fontSize: 18, lineHeight: 26 },
  body: { fontSize: 16, lineHeight: 24 },
  bodySmall: { fontSize: 13, lineHeight: 19 },
  label: { fontSize: 10, lineHeight: 14, letterSpacing: 1.15 },
  dataHero: { fontSize: 72, lineHeight: 70, letterSpacing: -3.6 },
  data: { fontSize: 30, lineHeight: 32, letterSpacing: -1 },
} as const;

export const motion = { fast: 120, standard: 200, fieldOpen: 520 } as const;
