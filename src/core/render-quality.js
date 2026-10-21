const PIXEL_BUDGET = 5_000_000;

// The animated map may render below CSS resolution on slower devices. HUD
// text stays native DOM; the backing store also stays bounded on large displays.
export function renderPixelRatio(
  width,
  height,
  devicePixelRatio = 1,
  quality = 1,
) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return 1;
  const device = Number.isFinite(devicePixelRatio)
    ? Math.max(1, Math.min(2, devicePixelRatio))
    : 1;
  const scale = Number.isFinite(quality)
    ? Math.max(0.5, Math.min(1, quality))
    : 1;
  return Math.min(device, Math.sqrt(PIXEL_BUDGET / (width * height))) * scale;
}

// Sample real frame intervals, including GPU/compositor waits. A single save
// or a suspended tab must not lower quality, and recovery is deliberately slow
// so changing weather cannot repeatedly resize the canvas.
export function createRenderQuality() {
  let quality = 1;
  let elapsed = 0;
  let frames = 0;
  let healthyTime = 0;
  let longestFrame = 0;
  return {
    get quality() {
      return quality;
    },
    reset() {
      elapsed = 0;
      frames = 0;
      healthyTime = 0;
      longestFrame = 0;
    },
    sample(frameMs) {
      if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 1000) {
        this.reset();
        return false;
      }
      elapsed += frameMs;
      frames++;
      longestFrame = Math.max(longestFrame, frameMs);
      if (elapsed < 1000 || frames < 2) return false;
      // Discard one isolated hitch, but retain a sustained low frame rate.
      const average = (elapsed - longestFrame) / (frames - 1);
      const previous = quality;
      if (average > 18.5) {
        quality = Math.max(0.5, quality * 0.85);
        healthyTime = 0;
      } else if (average <= 17.5) {
        healthyTime += elapsed;
        if (healthyTime >= 10000) {
          quality = Math.min(1, quality / 0.85);
          healthyTime = 0;
        }
      } else healthyTime = 0;
      elapsed = 0;
      frames = 0;
      longestFrame = 0;
      return previous !== quality;
    },
  };
}

// Soft atmospheric motion can update less often than controls and vessels.
// A changed reveal, viewport, projection, or camera jump must redraw at once.
export function createRenderCadence(interval = 1000 / 30, tolerance = 2) {
  let previous = null;
  return {
    reset() {
      previous = null;
    },
    shouldRender(time, frame) {
      if (
        previous &&
        time >= previous.time &&
        time - previous.time < interval &&
        frame.key === previous.key &&
        frame.width === previous.width &&
        frame.height === previous.height &&
        Math.abs(frame.x - previous.x) <= tolerance &&
        Math.abs(frame.y - previous.y) <= tolerance
      )
        return false;
      previous = { ...frame, time };
      return true;
    },
  };
}
