// All tunables for the sand system in one place. Tweak freely.

export const CFG = {
  // Particle population. At 2x2 blocks, each particle covers 4 pixels, so
  // density 0.09 → ~36% coverage — dense enough to read as a sand mask while
  // still letting the camera peek through the grain.
  PARTICLE_DENSITY: 0.09,
  PARTICLE_MAX: 130000,
  PARTICLE_SIZE: 2, // 1 or 2 (2 writes a 2x2 block per particle)

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

  // Sand palette (beige / tan / ochre)
  PALETTE: [
    [237, 201, 143, 232],
    [218, 178, 116, 232],
    [196, 154, 95, 232],
    [244, 222, 179, 224],
    [205, 170, 125, 232],
    [172, 132, 82, 240],
  ],
};
