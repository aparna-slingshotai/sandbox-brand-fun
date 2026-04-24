// The four particle forces. Each mutates vx/vy on the Sand instance.
//
// Keep these loops tight — at 20-130k particles they run every frame. No
// allocations inside loops; no `Math.hypot` (slower than inline sqrt).
//
// Anywhere a force touches a particle, call `sand.wake(i)` instead of poking
// state directly — that keeps the gravity pileHeight in sync.

import { CFG } from "./config.js";

// Draw: fingertip or mouse pushes particles radially outward within DRAW_RADIUS.
// Expects position in canvas-internal coordinate space.
//
// When `gravityOn` is true, the vertical component is clamped so the finger
// can only nudge sand sideways or downward — never launch it upward. That
// matches the mental model of "digging into a pile": grains collapse away
// from your finger, they don't shoot up out of the pile.
export function applyDraw(sand, fx, fy, gravityOn = false) {
  const { N, px, py, vx, vy, state, pileHeight, w, dpr } = sand;
  const R = CFG.DRAW_RADIUS * dpr;
  const R2 = R * R;
  const strength = CFG.DRAW_PUSH_STRENGTH;

  for (let i = 0; i < N; i++) {
    const dx = px[i] - fx;
    const dy = py[i] - fy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= R2) continue;

    const d = Math.sqrt(d2) || 0.0001;
    const push = ((R - d) / R) * strength * 6;
    const pushY = (dy / d) * push;
    vx[i] += (dx / d) * push;
    vy[i] += gravityOn ? Math.max(0, pushY) : pushY;

    if (state[i] === 1) {
      const x = px[i] | 0;
      if (x >= 0 && x < w && pileHeight[x] > 0) pileHeight[x]--;
      state[i] = 0;
    }
  }
}

// Radial wind: pushes every particle outward from a center point (cx, cy).
// Used by the mic-blow detector so that blowing scatters sand away from the
// camera like you're actually blowing on it. `strength` is a single multiplier
// (intensity × CFG.MIC_WIND_STRENGTH) that the caller has already computed.
export function applyRadialBlow(sand, cx, cy, strength) {
  const { N, px, py, vx, vy, state, pileHeight, w } = sand;
  const maxR = Math.max(w, sand.h);
  const falloffInv = 1 / maxR;

  for (let i = 0; i < N; i++) {
    const dx = px[i] - cx;
    const dy = py[i] - cy;
    const d2 = dx * dx + dy * dy;
    const d = Math.sqrt(d2) || 0.0001;
    // Falloff: particles near the blow center get hit harder.
    const falloff = 1 - Math.min(1, d * falloffInv);
    const push = strength * (0.4 + falloff * 0.9);
    vx[i] += (dx / d) * push + (Math.random() - 0.5) * 0.25;
    vy[i] += (dy / d) * push + (Math.random() - 0.5) * 0.25;

    if (state[i] === 1) {
      const x = px[i] | 0;
      if (x >= 0 && x < w && pileHeight[x] > 0) pileHeight[x]--;
      state[i] = 0;
    }
  }
}

// Wind: uniform force on every particle in direction `wx/wy`.
export function applyWind(sand, wx, wy) {
  const { N, vx, vy, state, px, pileHeight, w } = sand;
  const jitter = CFG.WIND_JITTER;

  for (let i = 0; i < N; i++) {
    vx[i] += wx + (Math.random() - 0.5) * jitter;
    vy[i] += wy + (Math.random() - 0.5) * jitter;

    if (state[i] === 1) {
      const x = px[i] | 0;
      if (x >= 0 && x < w && pileHeight[x] > 0) pileHeight[x]--;
      state[i] = 0;
    }
  }
}

// Clear: expanding circular ring shockwave. Returns true while animating.
export function stepClearAnim(sand, clearAnim, now) {
  const t = (now - clearAnim.startTime) / CFG.CLEAR_DURATION_MS;
  if (t >= 1) return false;

  const { N, px, py, vx, vy, state, pileHeight, w, h, dpr } = sand;
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.min(w, h) * CFG.CLEAR_MAX_RADIUS_PCT;

  const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
  const R = maxR * e;
  const ringWidth = CFG.CLEAR_RING_WIDTH * dpr;
  const innerR = R - ringWidth;
  const innerR2 = innerR > 0 ? innerR * innerR : 0;
  const R2 = R * R;
  const push = CFG.CLEAR_PUSH;

  for (let i = 0; i < N; i++) {
    const dx = px[i] - cx;
    const dy = py[i] - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > R2 || d2 < innerR2) continue;

    const d = Math.sqrt(d2) || 0.0001;
    vx[i] += (dx / d) * push;
    vy[i] += (dy / d) * push;

    if (state[i] === 1) {
      const x = px[i] | 0;
      if (x >= 0 && x < w && pileHeight[x] > 0) pileHeight[x]--;
      state[i] = 0;
    }
  }

  return true;
}

// Gravity: non-uniform fall with a per-column height map so sand stacks into
// an uneven pile instead of flattening into a strip at the bottom.
export function applyGravity(sand, now) {
  const { N, px, py, vx, vy, state, gVariance, driftSeed, pileHeight, w, h, dpr } = sand;
  const g = CFG.GRAVITY_BASE;
  const drift = CFG.GRAVITY_DRIFT;
  const air = CFG.GRAVITY_AIR;
  const particleSize = CFG.PARTICLE_SIZE;
  const floorJitter = CFG.GRAVITY_FLOOR_JITTER * dpr;
  const tsec = now * 0.001;

  for (let i = 0; i < N; i++) {
    if (state[i] === 1) continue;

    vy[i] += g * gVariance[i];
    vx[i] += Math.sin(tsec + driftSeed[i]) * drift;
    vy[i] *= air;

    // Determine the top of the pile in this particle's column.
    const x = px[i] | 0;
    const colX = x < 0 ? 0 : x >= w ? w - 1 : x;
    const stackBase = h - 1 - pileHeight[colX] * particleSize;
    const floor = stackBase - Math.random() * floorJitter;

    if (py[i] >= floor) {
      py[i] = floor;
      vy[i] = 0;
      vx[i] *= 0.4;

      if (Math.abs(vx[i]) < 0.02) {
        // Angle of repose: if a nearby column is significantly lower, slide
        // there instead. Prevents unrealistic vertical spires.
        const threshold = 2;
        let targetCol = colX;
        let targetH = pileHeight[colX];
        const candidates = [colX - 2, colX - 1, colX + 1, colX + 2];
        for (let k = 0; k < candidates.length; k++) {
          const nx = candidates[k];
          if (nx < 0 || nx >= w) continue;
          if (pileHeight[nx] < targetH - threshold) {
            targetH = pileHeight[nx];
            targetCol = nx;
          }
        }

        if (targetCol !== colX) {
          px[i] = targetCol + 0.5;
          py[i] = h - 1 - pileHeight[targetCol] * particleSize - Math.random() * floorJitter;
          pileHeight[targetCol]++;
        } else {
          pileHeight[colX]++;
        }
        state[i] = 1;
      }
    }
  }
}
