/** Shared visual language for the onboarding journey.
 *
 * "Moment" screens (welcome, preparing, celebrate) use the same cinematic
 * dark-teal scene as the splash so the journey feels like one continuous
 * sequence; interactive screens (demo, personalize, setup) stay on the app's
 * light surfaces so the product users preview is the product they get.
 */
export const Scene = {
  bgFrom: '#040E0C',
  bgVia: '#091F1A',
  bgTo: '#0E2C25',
  glow: '#2DD4BF',
  glowSoft: '#5EEAD4',
  gold: '#E0AC4C',
  text: '#F8FAFC',
  textDim: 'rgba(248,250,252,0.64)',
  textFaint: 'rgba(248,250,252,0.42)',
  /** Glass card surfaces on the dark scene. */
  cardBg: 'rgba(255,255,255,0.055)',
  cardBorder: 'rgba(94,234,212,0.16)',
  cardBorderSoft: 'rgba(148,163,184,0.18)',
} as const;

export const SceneGradient = [Scene.bgFrom, Scene.bgVia, Scene.bgTo] as const;
