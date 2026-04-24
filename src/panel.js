// Wires the bottom-right control panel to the live config + sand instance.
//
// Kept simple: a small declarative table of (input id, CFG key, formatter, and
// optional side-effect on sand). Slider writes mutate CFG in place so the
// render loop sees changes next frame with no restart.

import { CFG } from "./config.js";

const PRESET_HEX = "#4c3a59"; // dark purple default

export function initPanel(sand) {
  const panel = document.getElementById("panel");
  const toggle = document.getElementById("panel-toggle");

  // Open / close.
  toggle.addEventListener("click", () => {
    const collapsed = panel.classList.toggle("collapsed");
    toggle.setAttribute("aria-expanded", String(!collapsed));
  });

  const sliders = [
    {
      id: "ctl-count",
      label: "particle-count",
      get: () => sand.N,
      min: 2000,
      max: CFG.PARTICLE_MAX,
      format: (v) => v.toLocaleString(),
      apply: (v) => sand.setParticleCount(Math.round(v)),
    },
    {
      id: "ctl-size",
      label: "particle-size",
      get: () => CFG.PARTICLE_SIZE,
      min: 1,
      max: 3,
      format: (v) => `${v}×${v}`,
      apply: (v) => {
        CFG.PARTICLE_SIZE = Math.round(v);
      },
    },
    {
      id: "ctl-touch",
      label: "touch",
      get: () => CFG.DRAW_RADIUS,
      min: 10,
      max: 120,
      format: (v) => `${Math.round(v)} px`,
      apply: (v) => {
        CFG.DRAW_RADIUS = Math.round(v);
      },
    },
    {
      id: "ctl-wind",
      label: "wind",
      get: () => CFG.WIND_STRENGTH,
      min: 0.05,
      max: 1.6,
      format: (v) => v.toFixed(2),
      apply: (v) => {
        CFG.WIND_STRENGTH = v;
      },
    },
    {
      id: "ctl-gravity",
      label: "gravity",
      get: () => CFG.GRAVITY_BASE,
      min: 0.05,
      max: 0.9,
      format: (v) => v.toFixed(2),
      apply: (v) => {
        CFG.GRAVITY_BASE = v;
      },
    },
    {
      id: "ctl-vignette",
      label: "vignette",
      get: () => CFG.CLEAR_MAX_RADIUS_PCT,
      min: 0.2,
      max: 0.75,
      format: (v) => `${Math.round(v * 100)}%`,
      apply: (v) => {
        CFG.CLEAR_MAX_RADIUS_PCT = v;
      },
    },
  ];

  for (const s of sliders) {
    const el = document.getElementById(s.id);
    if (!el) continue;
    el.min = s.min;
    el.max = s.max;
    el.value = s.get();
    const valueEl = document.querySelector(`[data-val="${s.label}"]`);
    const updateLabel = () => {
      if (valueEl) valueEl.textContent = s.format(Number(el.value));
      // Track slider fill for the warm-gradient background in CSS.
      const pct = ((Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min))) * 100;
      el.style.setProperty("--fill", `${pct}%`);
    };
    updateLabel();
    el.addEventListener("input", () => {
      s.apply(Number(el.value));
      updateLabel();
    });
  }

  // Color picker — retints the whole palette.
  const colorEl = document.getElementById("ctl-color");
  if (colorEl) {
    colorEl.value = PRESET_HEX;
    sand.setTint(PRESET_HEX);
    colorEl.addEventListener("input", () => sand.setTint(colorEl.value));
  }
}
