# Sand Camera

A webcam filter where the feed is covered in a sand mask. Move your finger (or mouse) through the sand to reveal what's behind it. Three physics toggles make the sand come alive:

- **Wind** — point your index finger and the sand flies in the opposite direction
- **Clear** — an expanding shockwave wipes the center, leaving a sandy vignette around the edges
- **Gravity** — sand falls non-uniformly and piles up with a natural angle of repose

UI uses an iOS 26-style Liquid Glass design language: translucent surfaces, specular edges, soft floating shadows, and a bottom-right control panel with live tuning.

## Run locally

```bash
npm install
npm run dev
```

Open the URL it prints and allow camera access. The app needs a webcam for the mask to show you behind the sand, and for finger-pointing wind control.

## Tech

- Vanilla HTML + ES modules, bundled by **Vite**
- **MediaPipe HandLandmarker** (Tasks Vision, via CDN) for finger tracking
- **Canvas 2D** with `putImageData` for 20k+ particles at 60fps

## Deploy

One-click deploy to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Faparna-slingshotai%2Fsandbox-brand-fun)
