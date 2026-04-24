// Entry point: boot camera → sand → hand tracking → render loop.
//
// The render loop is the single rAF. Hand detection runs on its own rAF loop
// (inside HandTracker) so slow detection can't bottleneck rendering.

import { startCamera } from "./camera.js";
import { Sand } from "./sand.js";
import { UIState } from "./ui.js";
import { HandTracker } from "./hand-tracking.js";
import { MicBlow } from "./mic.js";
import { CFG } from "./config.js";
import { initPanel } from "./panel.js";
import {
  applyDraw,
  applyWind,
  applyRadialBlow,
  applyGravity,
  stepClearAnim,
} from "./forces.js";

const video = document.getElementById("video");
const canvas = document.getElementById("sand");
const permissionOverlay = document.getElementById("permission-overlay");
const permissionBtn = document.getElementById("permission-btn");
const permissionMsg = document.getElementById("permission-msg");
const hint = document.getElementById("hint");

const sand = new Sand(canvas);
const mic = new MicBlow();
const ui = new UIState(sand, mic);
initPanel(sand);

window.addEventListener("resize", () => {
  sand.resize();
});

// Fade the hint after a few seconds — it's noisy once the user gets it.
setTimeout(() => hint.classList.add("fade"), 4500);

let handTracker = null;

async function boot() {
  // Start the render loop immediately — sand should be interactive even before
  // the camera is granted, so the UX while resolving permissions still feels
  // alive instead of frozen on a modal.
  requestAnimationFrame(frame);

  // 1. Camera. If it fails, surface a visible overlay with a retry button.
  // The render loop keeps running against a black background behind the sand.
  let cameraOk = false;
  try {
    await startCamera(video);
    cameraOk = true;
  } catch (err) {
    showPermissionOverlay(err);
  }

  // 2. Hand tracking — only makes sense once the camera is running.
  if (cameraOk) {
    try {
      handTracker = new HandTracker(video);
      await handTracker.init();
      handTracker.start(sand);
    } catch (err) {
      console.warn("Hand tracking failed to initialize; mouse fallback only.", err);
      handTracker = null;
    }
  }
}

function showPermissionOverlay(err) {
  permissionOverlay.hidden = false;
  if (err && err.name === "NotAllowedError") {
    permissionMsg.textContent =
      "Camera access was blocked. Allow it in your browser's site settings, then retry.";
  } else if (err && err.name === "NotFoundError") {
    permissionMsg.textContent = "No camera found on this device.";
  } else {
    permissionMsg.textContent =
      "Could not start the camera. Click below to retry.";
  }
  permissionBtn.onclick = () => {
    permissionOverlay.hidden = true;
    boot();
  };
}

function frame(now) {
  // ---- Apply forces ----

  // Draw: hand wins over mouse when both are present.
  const hand = handTracker?.state;
  if (hand && hand.present) {
    applyDraw(sand, hand.tipX, hand.tipY, ui.gravityOn);
  } else if (ui.mouse.active) {
    applyDraw(sand, ui.mouse.x, ui.mouse.y, ui.gravityOn);
  }

  // Wind: only when mode is on AND hand is pointing.
  if (ui.windOn && hand && hand.present && hand.pointing) {
    // "All the sand goes to the opposite direction" — negate the pointing vector.
    const wx = -hand.dirX * CFG.WIND_STRENGTH;
    const wy = -hand.dirY * CFG.WIND_STRENGTH;
    applyWind(sand, wx, wy);
  }

  // Mic blow: sample amplitude and, above threshold, blow sand radially from
  // screen center as if the user is actually blowing at the camera.
  if (ui.micOn) {
    const intensity = mic.sample();
    if (intensity > 0) {
      const strength = intensity * CFG.MIC_WIND_STRENGTH;
      applyRadialBlow(sand, sand.w / 2, sand.h / 2, strength);
    }
  }

  // Clear: one-shot animated shockwave.
  if (ui.clearAnim) {
    const stillAnimating = stepClearAnim(sand, ui.clearAnim, now);
    if (!stillAnimating) ui.clearAnim = null;
  }

  // Gravity: while toggled on.
  if (ui.gravityOn) {
    applyGravity(sand, now);
  }

  // ---- Integrate + render ----
  sand.step();
  sand.render();

  // Cursor dot so the user can see where the finger/mouse is (sand hides them).
  if (hand && hand.present) {
    const color = ui.windOn && hand.pointing
      ? "rgba(160, 220, 255, 0.7)"
      : "rgba(255, 245, 220, 0.7)";
    sand.drawCursor(hand.tipX, hand.tipY, color);
  } else if (ui.mouse.active) {
    sand.drawCursor(ui.mouse.x, ui.mouse.y);
  }

  requestAnimationFrame(frame);
}

boot();
