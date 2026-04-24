// MediaPipe HandLandmarker wrapper.
//
// Loads the model from CDN, runs detection on an offscreen loop at ~30fps, and
// exposes a `handState` object the render loop can read without blocking.
// Coordinates are converted from the normalized MediaPipe space into canvas
// pixel coordinates, accounting for the CSS-mirrored video.

import { CFG } from "./config.js";

const LANDMARK = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_TIP: 20,
};

export class HandTracker {
  constructor(video) {
    this.video = video;
    this.landmarker = null;

    // Shared state the render loop reads every frame.
    this.state = {
      present: false, // hand visible this frame
      // Fingertip (index tip), mapped to canvas-internal coords.
      tipX: 0,
      tipY: 0,
      // Pointing direction vector (normalized). Points FROM knuckle TO tip, so
      // wind code needs to negate it.
      dirX: 0,
      dirY: 0,
      pointing: false, // debounced
    };

    this._rawPointing = false;
    this._pointingCounter = 0;
    this._running = false;
    this._lastVideoTime = -1;
  }

  async init() {
    const { HandLandmarker, FilesetResolver } = await import(
      /* @vite-ignore */
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs"
    );

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  }

  start(sand) {
    if (this._running) return;
    this._running = true;
    this._sand = sand;
    this._loop();
  }

  stop() {
    this._running = false;
  }

  _loop = () => {
    if (!this._running) return;
    const video = this.video;
    const lm = this.landmarker;

    if (video.readyState >= 2 && lm && video.currentTime !== this._lastVideoTime) {
      this._lastVideoTime = video.currentTime;
      try {
        const result = lm.detectForVideo(video, performance.now());
        this._handle(result);
      } catch (err) {
        // Silent — MediaPipe can throw transiently during tab switches; skip.
      }
    }
    requestAnimationFrame(this._loop);
  };

  _handle(result) {
    const s = this.state;
    const sand = this._sand;

    if (!result.landmarks || result.landmarks.length === 0) {
      s.present = false;
      this._rawPointing = false;
      this._pointingCounter = 0;
      s.pointing = false;
      return;
    }

    const hand = result.landmarks[0];

    // Map normalized landmark → canvas-internal pixel coords. The displayed
    // video is CSS-flipped, so we flip X here too.
    const toX = (n) => (1 - n.x) * sand.w;
    const toY = (n) => n.y * sand.h;

    const wrist = hand[LANDMARK.WRIST];
    const indexTip = hand[LANDMARK.INDEX_TIP];
    const indexPip = hand[LANDMARK.INDEX_PIP];
    const indexMcp = hand[LANDMARK.INDEX_MCP];

    s.tipX = toX(indexTip);
    s.tipY = toY(indexTip);
    s.present = true;

    // Pointing direction: from index MCP → index tip (i.e., the finger's axis).
    const mcpX = toX(indexMcp);
    const mcpY = toY(indexMcp);
    const dx = s.tipX - mcpX;
    const dy = s.tipY - mcpY;
    const mag = Math.sqrt(dx * dx + dy * dy) || 1;
    s.dirX = dx / mag;
    s.dirY = dy / mag;

    // Pointing gesture: index extended, others curled.
    // Compare each fingertip's distance from wrist vs the corresponding PIP's
    // distance from wrist. Extended ⇒ tip is further than PIP; curled ⇒ not.
    const distWrist = (pt) => {
      const ax = pt.x - wrist.x;
      const ay = pt.y - wrist.y;
      return Math.sqrt(ax * ax + ay * ay);
    };
    const ratio = (tip, pip) => distWrist(tip) / (distWrist(pip) || 0.0001);

    const indexR = ratio(indexTip, indexPip);
    const middleR = ratio(hand[LANDMARK.MIDDLE_TIP], hand[LANDMARK.MIDDLE_PIP]);
    const ringR = ratio(hand[LANDMARK.RING_TIP], hand[LANDMARK.RING_PIP]);
    const pinkyR = ratio(hand[LANDMARK.PINKY_TIP], hand[LANDMARK.PINKY_PIP]);

    const indexExtended = indexR > CFG.POINTING_EXTENSION_RATIO;
    const othersCurled =
      middleR < CFG.POINTING_CURL_RATIO &&
      ringR < CFG.POINTING_CURL_RATIO &&
      pinkyR < CFG.POINTING_CURL_RATIO;

    this._rawPointing = indexExtended && othersCurled;

    // Debounce — only flip `state.pointing` after N consecutive matching frames.
    if (this._rawPointing === s.pointing) {
      this._pointingCounter = 0;
    } else {
      this._pointingCounter++;
      if (this._pointingCounter >= CFG.POINTING_DEBOUNCE_FRAMES) {
        s.pointing = this._rawPointing;
        this._pointingCounter = 0;
      }
    }
  }
}
