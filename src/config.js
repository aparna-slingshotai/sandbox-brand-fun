// All tunables for the sand system in one place. Tweak freely.

export const CFG = {
  // Particle population. Particles are placed on a jittered grid sized to
  // PARTICLE_SIZE so initial coverage is 100% — the sand reads as a true
  // opaque mask until disturbed. Density is only used as a fallback cap.
  PARTICLE_DENSITY: 0.14,
  PARTICLE_MAX: 260000,
  PARTICLE_SIZE: 3, // 1, 2, or 3 — also controls the grid cell at reset()

  // Motion
  DAMPING: 0.985, // velocity decay per frame
  MAX_SPEED: 22, // clamp to keep pushes sane

  // Draw (fingertip / mouse)
  DRAW_RADIUS: 44,
  DRAW_PUSH_STRENGTH: 0.85,
  CURSOR_RADIUS: 7,

  // Wind (while pointing and Wind mode is on)
  WIND_STRENGTH: 0.55,
  WIND_JITTER: 0.25,

  // Clear (one-shot animated shockwave)
  CLEAR_DURATION_MS: 900,
  CLEAR_MAX_RADIUS_PCT: 0.42, // stops at 42% of min(w,h) → leaves a sandy vignette
  CLEAR_RING_WIDTH: 38,
  CLEAR_PUSH: 7.5,

  // Gravity (toggle)
  GRAVITY_BASE: 0.28,
  GRAVITY_VARIANCE: [0.55, 1.45],
  GRAVITY_DRIFT: 0.06, // horizontal drift amplitude
  GRAVITY_AIR: 0.985, // per-frame vy decay
  GRAVITY_FLOOR_JITTER: 4, // px of randomness in the settle line

  // Pointing detection
  POINTING_EXTENSION_RATIO: 1.2, // index tip vs PIP distance to wrist
  POINTING_CURL_RATIO: 1.05, // other fingers must be below this
  POINTING_DEBOUNCE_FRAMES: 4,

  // Sand palette — shaded around the dark-purple default (76, 58, 89). Alpha
  // is 255 so the sand reads as a true mask that hides the camera completely
  // wherever particles sit. The panel's color picker regenerates this palette
  // on the fly when the user changes the tint.
  PALETTE: [
    [47, 36, 55, 255],
    [60, 46, 70, 255],
    [68, 52, 80, 255],
    [76, 58, 89, 255],
    [88, 67, 103, 255],
    [102, 78, 119, 255],
  ],

  // Mic blow detection
  MIC_BLOW_THRESHOLD: 0.16, // normalized amplitude above which a blow fires
  MIC_WIND_STRENGTH: 0.75, // multiplied by amplitude → radial outward push
  MIC_FFT_SIZE: 512,
  MIC_BAND_LOW: 2, // FFT bin (~86Hz) — skip DC / rumble
  MIC_BAND_HIGH: 24, // ~2000Hz — focus on breath frequencies
};
