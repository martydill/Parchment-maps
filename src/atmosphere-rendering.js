import { sampleLighthouse } from "./core/seascape.js";

const darknessCanvas = document.createElement("canvas");
const darknessContext = darknessCanvas.getContext("2d");
const DARKNESS_SCALE = 0.5;
let darknessState = null;

function darknessUnchanged(lighting, width, height, ship, lighthouses) {
  return (
    darknessState &&
    darknessState.width === width &&
    darknessState.height === height &&
    darknessState.night === lighting.night &&
    darknessState.moon === lighting.moon &&
    darknessState.storm === lighting.storm &&
    darknessState.shipX === ship.x &&
    darknessState.shipY === ship.y &&
    darknessState.lighthouses.length === lighthouses.length &&
    lighthouses.every((light, index) => {
      const previous = darknessState.lighthouses[index];
      return (
        previous.x === light.x &&
        previous.y === light.y &&
        previous.index === light.index
      );
    })
  );
}

function glow(c, x, y, radius, inner, outer = "rgba(255,255,255,0)") {
  const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  c.fillStyle = gradient;
  c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function intersectsScreen(left, top, right, bottom, width, height) {
  // Retain an extra screen pixel for antialiasing at the viewport boundary.
  return right >= -1 && bottom >= -1 && left <= width + 1 && top <= height + 1;
}

const stars = Array.from({ length: 95 }, (_, index) => {
  const fraction = (value) => value - Math.floor(value);
  return {
    x: fraction(Math.sin(index * 127.1 + 4.7) * 43758.5453),
    y: fraction(Math.sin(index * 311.7 + 9.2) * 28917.126),
  };
});

function drawCelestialLight(c, lighting, width, height, time, reducedMotion) {
  const twilight = Math.max(lighting.sunrise, lighting.sunset);
  if (twilight > 0.01) {
    const rising = lighting.sunrise >= lighting.sunset;
    const x = width * (rising ? 0.64 : 0.38);
    const y = height * 0.28;
    const warmth = twilight * (1 - lighting.storm * 0.72);
    c.save();
    c.globalCompositeOperation = "screen";
    glow(
      c,
      x,
      y,
      Math.max(width, height) * 0.75,
      `rgba(255,124,69,${warmth * 0.22})`,
    );
    glow(
      c,
      x,
      y,
      Math.min(width, height) * 0.26,
      `rgba(255,205,116,${warmth * 0.38})`,
    );
    c.globalAlpha = warmth * 0.48;
    c.fillStyle = "#fff2bf";
    c.beginPath();
    c.arc(x, y, 15 + twilight * 9, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  if (lighting.stars < 0.04) return;
  c.save();
  c.globalCompositeOperation = "screen";
  const moonX = width * 0.76;
  const moonY = height * 0.19;
  const moonStrength =
    lighting.stars * lighting.moon * (1 - lighting.storm * 0.75);
  glow(
    c,
    moonX,
    moonY,
    Math.min(width, height) * 0.28,
    `rgba(141,186,235,${moonStrength * 0.18})`,
  );
  c.fillStyle = `rgba(232,240,255,${moonStrength * 0.7})`;
  c.beginPath();
  c.arc(moonX, moonY, 10 + lighting.moon * 5, 0, Math.PI * 2);
  c.fill();
  for (let index = 0; index < 95; index++) {
    const x = stars[index].x * width;
    const y = stars[index].y * height * 0.68;
    const twinkle = reducedMotion
      ? 0.8
      : 0.7 + Math.sin(time * 0.0015 + index * 4.7) * 0.3;
    const alpha = lighting.stars * twinkle * (0.2 + (index % 7) * 0.075);
    c.fillStyle = `rgba(223,235,255,${alpha})`;
    c.beginPath();
    c.arc(x, y, index % 11 === 0 ? 1.5 : 0.8, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

// A separate surface lets destination-out remove only the darkness, preserving
// the terrain below each lamp. All coordinates here are screen pixels.
export function drawNightAtmosphere(
  c,
  { lighting, width, height, ship, lighthouses, time, reducedMotion },
) {
  if (lighting.night < 0.015) {
    drawCelestialLight(c, lighting, width, height, time, reducedMotion);
    return;
  }
  const maskWidth = Math.ceil(width * DARKNESS_SCALE);
  const maskHeight = Math.ceil(height * DARKNESS_SCALE);
  if (
    darknessCanvas.width !== maskWidth ||
    darknessCanvas.height !== maskHeight
  ) {
    darknessCanvas.width = maskWidth;
    darknessCanvas.height = maskHeight;
    darknessState = null;
  }
  // Beam rotation and star twinkle do not change this painted mask. Reusing
  // its exact pixels avoids repainting every lamp while the view is steady.
  if (!darknessUnchanged(lighting, width, height, ship, lighthouses)) {
    paintDarkness(lighting, width, height, ship, lighthouses);
    darknessState = {
      width,
      height,
      night: lighting.night,
      moon: lighting.moon,
      storm: lighting.storm,
      shipX: ship.x,
      shipY: ship.y,
      lighthouses: lighthouses.map(({ x, y, index }) => ({ x, y, index })),
    };
  }
  c.drawImage(darknessCanvas, 0, 0, width, height);
  drawCelestialLight(c, lighting, width, height, time, reducedMotion);
  c.save();
  c.globalCompositeOperation = "screen";
  glow(c, ship.x, ship.y, 110, `rgba(255,180,76,${lighting.night * 0.26})`);
  for (const light of lighthouses) {
    const { angle: sweep, reach } = sampleLighthouse(
      reducedMotion ? 0 : time,
      light.index,
    );
    const ax = light.x + Math.cos(sweep - 0.13) * reach;
    const ay = light.y + Math.sin(sweep - 0.13) * reach;
    const bx = light.x + Math.cos(sweep + 0.13) * reach;
    const by = light.y + Math.sin(sweep + 0.13) * reach;
    if (
      intersectsScreen(
        Math.min(light.x, ax, bx),
        Math.min(light.y, ay, by),
        Math.max(light.x, ax, bx),
        Math.max(light.y, ay, by),
        width,
        height,
      )
    ) {
      const beam = c.createRadialGradient(
        light.x,
        light.y,
        0,
        light.x,
        light.y,
        reach,
      );
      beam.addColorStop(0, `rgba(255,223,151,${lighting.night * 0.1})`);
      beam.addColorStop(1, "rgba(255,223,151,0)");
      c.fillStyle = beam;
      c.beginPath();
      c.moveTo(light.x, light.y);
      c.lineTo(ax, ay);
      c.lineTo(bx, by);
      c.closePath();
      c.fill();
    }
    if (
      intersectsScreen(
        light.x - 65,
        light.y - 65,
        light.x + 65,
        light.y + 65,
        width,
        height,
      )
    )
      glow(
        c,
        light.x,
        light.y,
        65,
        `rgba(255,206,110,${lighting.night * 0.32})`,
      );
    if (
      intersectsScreen(
        light.x - 3.5,
        light.y - 3.5,
        light.x + 3.5,
        light.y + 3.5,
        width,
        height,
      )
    ) {
      c.fillStyle = `rgba(255,242,187,${lighting.night})`;
      c.beginPath();
      c.arc(light.x, light.y, 3.5, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}

function paintDarkness(lighting, width, height, ship, lighthouses) {
  const d = darknessContext;
  d.setTransform(DARKNESS_SCALE, 0, 0, DARKNESS_SCALE, 0, 0);
  d.clearRect(0, 0, width, height);
  const density =
    lighting.night * (0.8 - lighting.moon * 0.13 + lighting.storm * 0.1);
  const shade = d.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, `rgba(8,19,43,${Math.min(0.94, density + 0.05)})`);
  shade.addColorStop(1, `rgba(5,17,31,${Math.min(0.94, density)})`);
  d.fillStyle = shade;
  d.fillRect(0, 0, width, height);
  d.globalCompositeOperation = "destination-out";
  glow(d, ship.x, ship.y, 170, `rgba(0,0,0,${lighting.night * 0.85})`);
  for (const light of lighthouses) {
    const { reach } = sampleLighthouse(0, light.index);
    glow(
      d,
      light.x,
      light.y,
      reach * 0.65,
      `rgba(0,0,0,${lighting.night * 0.9})`,
    );
  }
  d.globalCompositeOperation = "source-over";
}

export function drawShipLanterns(c, ship, lighting) {
  if (lighting.night < 0.08) return;
  c.save();
  c.globalCompositeOperation = "screen";
  for (const offset of [-13, 13]) {
    const x = ship.x + Math.cos(ship.angle) * offset;
    const y = ship.y + Math.sin(ship.angle) * offset * 0.9;
    glow(c, x, y, 35, `rgba(255,187,75,${lighting.night * 0.55})`);
    c.fillStyle = `rgba(255,237,167,${lighting.night * 0.95})`;
    c.beginPath();
    c.arc(x, y, 2.2, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}
