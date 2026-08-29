export const colors = {
  paper: "#F3F0E8",
  paperRaised: "#FFFDF8",
  ink: "#171814",
  inkSoft: "#3D3E39",
  muted: "#5D5E58",
  rule: "#C9C5BA",
  ruleStrong: "#8C8B84",
  signal: "#FF5C35",
  impact: "#C9F36B",
  record: "#9CB8FF",
  success: "#21633B",
  danger: "#B33126",
  warning: "#F6D67A",
  focus: "#3157D5",
  white: "#FFFDF8",
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 20,
  control: 8,
  surface: 12,
  modal: 20,
  pill: 999,
} as const;

export const borders = {
  standard: 1,
  active: 2,
  emphasis: 7,
} as const;

export const shadows = {
  none: "none",
  menu: "0 6px 20px rgba(23, 24, 20, 0.08)",
  modal: "0 18px 48px rgba(23, 24, 20, 0.14)",
} as const;

export const elevation = {
  base: 0,
  menu: 1,
  modal: 2,
} as const;

export const breakpoints = {
  compact: 480,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
} as const;

export const fonts = {
  brand: "FamiljenGrotesk_400Regular",
  brandMedium: "FamiljenGrotesk_500Medium",
  brandSemiBold: "FamiljenGrotesk_600SemiBold",
  brandBold: "FamiljenGrotesk_700Bold",
  mono: "IBMPlexMono_400Regular",
  monoMedium: "IBMPlexMono_500Medium",
  monoSemiBold: "IBMPlexMono_600SemiBold",
} as const;

export const type = {
  display: { fontSize: 48, lineHeight: 46, letterSpacing: -1.8 },
  displaySmall: { fontSize: 36, lineHeight: 37, letterSpacing: -1.1 },
  heading: { fontSize: 24, lineHeight: 28, letterSpacing: -0.5 },
  bodyLarge: { fontSize: 18, lineHeight: 27 },
  body: { fontSize: 16, lineHeight: 24 },
  bodySmall: { fontSize: 13, lineHeight: 19 },
  label: { fontSize: 11, lineHeight: 15, letterSpacing: 1.1 },
  dataHero: { fontSize: 68, lineHeight: 68, letterSpacing: -3 },
  data: { fontSize: 30, lineHeight: 32, letterSpacing: -1 },
} as const;

export const motion = {
  fast: 120,
  standard: 200,
  deliberate: 520,
} as const;
