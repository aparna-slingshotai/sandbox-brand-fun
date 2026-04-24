// Request webcam and attach to a <video> element. Returns the video element
// once playback has started so the caller can safely use its dimensions.

export async function startCamera(video) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: "user",
    },
    audio: false,
  });
  video.srcObject = stream;
  await new Promise((resolve) => {
    if (video.readyState >= 2) resolve();
    else video.addEventListener("loadeddata", resolve, { once: true });
  });
  await video.play().catch(() => {});
  return video;
}
