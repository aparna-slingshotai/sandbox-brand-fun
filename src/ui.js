// Owns user-facing mode state (which buttons are toggled), wires button clicks,
// and provides a mouse/touch fallback for the draw force.

export class UIState {
  constructor(sand, mic) {
    this.sand = sand;
    this.mic = mic;

    // Toggle / one-shot state read by the render loop.
    this.windOn = false;
    this.micOn = false;
    this.gravityOn = false;
    this.clearAnim = null; // { startTime: number } when running

    // Mouse / touch state (canvas-internal coords, DPR-scaled).
    this.mouse = { active: false, x: 0, y: 0 };

    this._wireButtons();
    this._wireMouse();
  }

  _wireButtons() {
    const $ = (id) => document.getElementById(id);
    this.btnWind = $("btn-wind");
    this.btnMic = $("btn-mic");
    this.btnGravity = $("btn-gravity");
    this.btnClear = $("btn-clear");
    this.btnReset = $("btn-reset");

    this.btnWind.addEventListener("click", () => {
      this.windOn = !this.windOn;
      this.btnWind.classList.toggle("active", this.windOn);
    });

    this.btnMic.addEventListener("click", async () => {
      if (this.micOn) {
        // Toggle off — disable sampling but keep permission.
        this.mic.disable();
        this.micOn = false;
        this.btnMic.classList.remove("active");
        return;
      }
      try {
        this.btnMic.classList.add("loading");
        await this.mic.enable();
        this.micOn = true;
        this.btnMic.classList.add("active");
      } catch (err) {
        console.warn("Mic permission denied or unavailable.", err);
        this.showHint("Mic access denied — check browser permissions");
      } finally {
        this.btnMic.classList.remove("loading");
      }
    });

    this.btnGravity.addEventListener("click", () => {
      this.gravityOn = !this.gravityOn;
      this.btnGravity.classList.toggle("active", this.gravityOn);
    });

    this.btnClear.addEventListener("click", () => {
      this.clearAnim = { startTime: performance.now() };
      // Brief visual pulse on the button.
      this.btnClear.classList.add("active");
      setTimeout(() => this.btnClear.classList.remove("active"), 600);
    });

    this.btnReset.addEventListener("click", () => {
      this.windOn = false;
      this.gravityOn = false;
      this.clearAnim = null;
      this.btnWind.classList.remove("active");
      this.btnGravity.classList.remove("active");
      this.sand.reset();
    });
  }

  showHint(text, ms = 2600) {
    const hint = document.getElementById("hint");
    if (!hint) return;
    hint.textContent = text;
    hint.classList.remove("fade");
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => hint.classList.add("fade"), ms);
  }

  _wireMouse() {
    const canvas = this.sand.canvas;

    const toInternal = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * this.sand.w;
      const y = ((clientY - rect.top) / rect.height) * this.sand.h;
      return { x, y };
    };

    canvas.addEventListener("mousemove", (e) => {
      const { x, y } = toInternal(e.clientX, e.clientY);
      this.mouse.active = true;
      this.mouse.x = x;
      this.mouse.y = y;
    });

    canvas.addEventListener("mouseleave", () => {
      this.mouse.active = false;
    });

    // Touch support — treat a single touch as a fingertip.
    canvas.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 0) return;
        const t = e.touches[0];
        const { x, y } = toInternal(t.clientX, t.clientY);
        this.mouse.active = true;
        this.mouse.x = x;
        this.mouse.y = y;
      },
      { passive: true }
    );

    canvas.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 0) return;
        const t = e.touches[0];
        const { x, y } = toInternal(t.clientX, t.clientY);
        this.mouse.active = true;
        this.mouse.x = x;
        this.mouse.y = y;
      },
      { passive: true }
    );

    canvas.addEventListener("touchend", () => {
      this.mouse.active = false;
    });

    canvas.addEventListener("touchcancel", () => {
      this.mouse.active = false;
    });
  }
}
