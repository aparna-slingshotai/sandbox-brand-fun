// Sand particle system.
//
// Structure-of-Arrays typed-array layout + a single ImageData blit per frame.
// This is what keeps 20k+ particles at 60fps — `fillRect` per particle would
// tank to 15-20fps on a mid-range laptop.

import { CFG } from "./config.js";

function hexToRgb(hex) {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export class Sand {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    this.w = 0;
    this.h = 0;
    this.N = 0;

    // Physics arrays — allocated in resize()
    this.px = null;
    this.py = null;
    this.vx = null;
    this.vy = null;
    this.col = null;
    this.state = null;
    this.gVariance = null;
    this.driftSeed = null;

    // Height of the settled gravity pile, per column. Lets particles stack
    // rather than all collapsing into a thin line at the bottom.
    this.pileHeight = null;

    this.imgData = null;

    this.resize();
  }

  resize() {
    // Cap DPR at 1 — sand is inherently a pixel-level effect, so higher
    // internal resolution just multiplies particle count for no visual gain.
    const dpr = 1;
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = window.innerWidth + "px";
    this.canvas.style.height = window.innerHeight + "px";
    this.dpr = dpr;

    const capByArea = Math.floor(w * h * CFG.PARTICLE_DENSITY);
    this.N = Math.min(CFG.PARTICLE_MAX, capByArea);

    this.px = new Float32Array(this.N);
    this.py = new Float32Array(this.N);
    this.vx = new Float32Array(this.N);
    this.vy = new Float32Array(this.N);
    this.col = new Uint8Array(this.N);
    this.state = new Uint8Array(this.N);
    this.gVariance = new Float32Array(this.N);
    this.driftSeed = new Float32Array(this.N);
    this.pileHeight = new Uint16Array(w);

    this.imgData = this.ctx.createImageData(w, h);

    this.reset();
  }

  reset() {
    const [gMin, gMax] = CFG.GRAVITY_VARIANCE;
    const palN = CFG.PALETTE.length;
    for (let i = 0; i < this.N; i++) {
      this.px[i] = Math.random() * this.w;
      this.py[i] = Math.random() * this.h;
      this.vx[i] = 0;
      this.vy[i] = 0;
      this.col[i] = Math.floor(Math.random() * palN);
      this.state[i] = 0;
      this.gVariance[i] = gMin + Math.random() * (gMax - gMin);
      this.driftSeed[i] = Math.random() * Math.PI * 2;
    }
    if (this.pileHeight) this.pileHeight.fill(0);
  }

  // Wake a particle that was resting in the gravity pile. Call this from
  // force functions before applying motion, so pileHeight stays accurate.
  wake(i) {
    if (this.state[i] !== 1) return;
    const x = this.px[i] | 0;
    if (x >= 0 && x < this.w && this.pileHeight[x] > 0) {
      this.pileHeight[x]--;
    }
    this.state[i] = 0;
  }

  // Integrate velocity → position, apply damping, clamp to viewport.
  // Callers should have applied forces to vx/vy before calling this.
  step() {
    const { w, h, N, px, py, vx, vy, state } = this;
    const damping = CFG.DAMPING;
    const maxSp = CFG.MAX_SPEED;

    for (let i = 0; i < N; i++) {
      if (state[i] === 1) continue; // resting (gravity pile)

      let a = vx[i] * damping;
      let b = vy[i] * damping;

      // Clamp speed so a runaway push can't nuke the sim.
      const sp2 = a * a + b * b;
      if (sp2 > maxSp * maxSp) {
        const s = maxSp / Math.sqrt(sp2);
        a *= s;
        b *= s;
      }
      vx[i] = a;
      vy[i] = b;

      let x = px[i] + a;
      let y = py[i] + b;

      // Wrap horizontally, clamp vertically with bounce.
      if (x < 0) x += w;
      else if (x >= w) x -= w;
      if (y < 0) {
        y = 0;
        vy[i] = -vy[i] * 0.4;
      } else if (y >= h) {
        y = h - 1;
        vy[i] = -vy[i] * 0.4;
      }

      px[i] = x;
      py[i] = y;
    }
  }

  // Write particles into the ImageData buffer and blit. One draw call per frame.
  render() {
    const { w, h, N, px, py, col, imgData, ctx } = this;
    const data = imgData.data;

    // Clear buffer — fastest on Uint8ClampedArray is .fill(0).
    data.fill(0);

    const pal = CFG.PALETTE;
    const size = CFG.PARTICLE_SIZE;

    for (let i = 0; i < N; i++) {
      const x = px[i] | 0;
      const y = py[i] | 0;
      if (x < 0 || x >= w - 1 || y < 0 || y >= h - 1) continue;

      const c = pal[col[i]];
      const r = c[0], g = c[1], b = c[2], a = c[3];
      const base = (y * w + x) * 4;
      data[base] = r;
      data[base + 1] = g;
      data[base + 2] = b;
      data[base + 3] = a;

      if (size >= 2) {
        const right = base + 4;
        data[right] = r;
        data[right + 1] = g;
        data[right + 2] = b;
        data[right + 3] = a;

        const down = base + w * 4;
        data[down] = r;
        data[down + 1] = g;
        data[down + 2] = b;
        data[down + 3] = a;

        const diag = down + 4;
        data[diag] = r;
        data[diag + 1] = g;
        data[diag + 2] = b;
        data[diag + 3] = a;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  // Re-tint all particles around a single hue. Each particle gets a palette
  // entry with varied lightness so we keep the natural grainy/dusty feel.
  setTint(hex) {
    const { r, g, b } = hexToRgb(hex);
    // Build a 6-entry palette: shades from darker (60%) to lighter (130%).
    const shades = [0.62, 0.78, 0.9, 1.02, 1.15, 1.3];
    const alphas = [232, 232, 232, 224, 232, 240];
    const pal = shades.map((s, i) => [
      Math.max(0, Math.min(255, Math.round(r * s))),
      Math.max(0, Math.min(255, Math.round(g * s))),
      Math.max(0, Math.min(255, Math.round(b * s))),
      alphas[i],
    ]);
    CFG.PALETTE = pal;
  }

  // Rebuild particle arrays to a new size without re-randomizing positions for
  // the surviving particles. Used by the control panel to change count live.
  setParticleCount(newN) {
    newN = Math.max(100, Math.min(CFG.PARTICLE_MAX, Math.floor(newN)));
    if (newN === this.N) return;
    const [gMin, gMax] = CFG.GRAVITY_VARIANCE;
    const palN = CFG.PALETTE.length;

    const copy = (Src, Dst) => {
      const n = Math.min(this.N, newN);
      Dst.set(Src.subarray(0, n));
    };

    const npx = new Float32Array(newN);
    const npy = new Float32Array(newN);
    const nvx = new Float32Array(newN);
    const nvy = new Float32Array(newN);
    const ncol = new Uint8Array(newN);
    const nstate = new Uint8Array(newN);
    const ngVar = new Float32Array(newN);
    const nseed = new Float32Array(newN);

    copy(this.px, npx);
    copy(this.py, npy);
    copy(this.vx, nvx);
    copy(this.vy, nvy);
    copy(this.col, ncol);
    copy(this.state, nstate);
    copy(this.gVariance, ngVar);
    copy(this.driftSeed, nseed);

    // Initialize any newly added particles.
    for (let i = this.N; i < newN; i++) {
      npx[i] = Math.random() * this.w;
      npy[i] = Math.random() * this.h;
      nvx[i] = 0;
      nvy[i] = 0;
      ncol[i] = Math.floor(Math.random() * palN);
      nstate[i] = 0;
      ngVar[i] = gMin + Math.random() * (gMax - gMin);
      nseed[i] = Math.random() * Math.PI * 2;
    }

    this.px = npx;
    this.py = npy;
    this.vx = nvx;
    this.vy = nvy;
    this.col = ncol;
    this.state = nstate;
    this.gVariance = ngVar;
    this.driftSeed = nseed;
    this.N = newN;
    // Pile heights are no longer accurate after a resize — clear and let the
    // pile rebuild naturally. Also unset any resting state that referenced
    // stale pile rows.
    this.pileHeight.fill(0);
    for (let i = 0; i < newN; i++) this.state[i] = 0;
  }

  // Draw an overlay (e.g., fingertip cursor). Called after render(), so it uses
  // the normal 2D API on top of the blitted sand.
  drawCursor(x, y, color = "rgba(255, 245, 220, 0.55)") {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, CFG.CURSOR_RADIUS * this.dpr, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1.5 * this.dpr;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.stroke();
    ctx.restore();
  }
}
