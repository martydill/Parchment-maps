import { sampleLighthouse } from "./core/seascape.js";
import { createAlphaPalette } from "./style-palette.js";

const starStyle = createAlphaPalette("223,235,255", 0, 0.65, 128);

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

function lightBloom(c, x, y, radius, color, strength, aspect = 1) {
  c.save();
  c.translate(x, y);
  c.scale(1, aspect);
  const gradient = c.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, `rgba(${color},${strength})`);
  gradient.addColorStop(0.18, `rgba(${color},${strength * 0.55})`);
  gradient.addColorStop(0.5, `rgba(${color},${strength * 0.13})`);
  gradient.addColorStop(1, `rgba(${color},0)`);
  c.fillStyle = gradient;
  c.fillRect(-radius, -radius, radius * 2, radius * 2);
  c.restore();
}

// Nested, low-opacity cones feather the angular edge as well as the range.
// The outer arc has no visible rim because the radial falloff reaches zero.
const BEAM_FEATHER = [
  [1, 0.08],
  [0.82, 0.13],
  [0.64, 0.18],
  [0.46, 0.25],
  [0.28, 0.36],
];

function drawLighthouseBeam(c, light, sample, angle, strength, width, height) {
  const { reach, beamWidth, color } = sample;
  const ax = light.x + Math.cos(angle - beamWidth) * reach;
  const ay = light.y + Math.sin(angle - beamWidth) * reach;
  const bx = light.x + Math.cos(angle + beamWidth) * reach;
  const by = light.y + Math.sin(angle + beamWidth) * reach;
  const bulge = reach * (1 - Math.cos(beamWidth));
  if (
    !intersectsScreen(
      Math.min(light.x, ax, bx) - bulge,
      Math.min(light.y, ay, by) - bulge,
      Math.max(light.x, ax, bx) + bulge,
      Math.max(light.y, ay, by) + bulge,
      width,
      height,
    )
  )
    return;
  const beam = c.createRadialGradient(
    light.x,
    light.y,
    0,
    light.x,
    light.y,
    reach,
  );
  beam.addColorStop(0, `rgba(${color},${strength * 0.16})`);
  beam.addColorStop(0.06, `rgba(${color},${strength * 0.28})`);
  beam.addColorStop(0.25, `rgba(${color},${strength * 0.2})`);
  beam.addColorStop(0.65, `rgba(${color},${strength * 0.075})`);
  beam.addColorStop(1, `rgba(${color},0)`);
  c.save();
  c.fillStyle = beam;
  for (const [spread, alpha] of BEAM_FEATHER) {
    const halfAngle = beamWidth * spread;
    c.globalAlpha = alpha;
    c.beginPath();
    c.moveTo(light.x, light.y);
    c.lineTo(
      light.x + Math.cos(angle - halfAngle) * reach,
      light.y + Math.sin(angle - halfAngle) * reach,
    );
    c.arc(light.x, light.y, reach, angle - halfAngle, angle + halfAngle);
    c.closePath();
    c.fill();
  }
  c.restore();
}

function drawBeaconFlame(c, light, sample, strength) {
  const { flameHeight: h, sway, lampRadius: r, ember } = sample;
  c.save();
  c.translate(light.x, light.y);
  c.fillStyle = `rgba(255,112,38,${strength * 0.85})`;
  c.beginPath();
  c.moveTo(-r, 2);
  c.bezierCurveTo(-r * 2, -h * 0.3, sway - r, -h * 0.62, sway, -h);
  c.bezierCurveTo(sway + r * 0.35, -h * 0.45, r * 2, -h * 0.3, r, 2);
  c.closePath();
  c.fill();
  c.fillStyle = `rgba(255,224,137,${strength})`;
  c.beginPath();
  c.moveTo(-r * 0.6, 1);
  c.bezierCurveTo(-r, -h * 0.2, sway * 0.5, -h * 0.4, sway * 0.6, -h * 0.65);
  c.bezierCurveTo(r * 0.9, -h * 0.25, r, -h * 0.1, r * 0.6, 1);
  c.closePath();
  c.fill();
  // A tiny rising cinder sells open fire without becoming a particle cloud.
  c.fillStyle = `rgba(255,190,89,${strength * (1 - ember) * 0.65})`;
  c.beginPath();
  c.arc(sway + Math.sin(ember * 5) * 3, -h - ember * 13, 0.7, 0, Math.PI * 2);
  c.fill();
  c.restore();
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
    c.fillStyle = starStyle(alpha);
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
    const sample = sampleLighthouse(reducedMotion ? 0 : time, light.index);
    const strength =
      lighting.night * sample.intensity * (1 - lighting.storm * 0.3);
    for (let beam = 0; beam < sample.beams; beam++)
      drawLighthouseBeam(
        c,
        light,
        sample,
        sample.angle + beam * Math.PI,
        strength * (beam === 0 ? 1 : 0.7),
        width,
        height,
      );
    const radius = sample.glowRadius * 1.8;
    if (
      intersectsScreen(
        light.x - radius,
        light.y - radius,
        light.x + radius,
        light.y + radius,
        width,
        height,
      )
    ) {
      // Flattened spill follows the chart's sea plane; tight bloom leaves
      // darkness between neighboring ports instead of identical lit discs.
      lightBloom(
        c,
        light.x,
        light.y + 5,
        radius,
        sample.color,
        strength * 0.2,
        0.5,
      );
      lightBloom(
        c,
        light.x,
        light.y,
        sample.glowRadius,
        sample.color,
        strength * 0.42,
      );
      if (sample.kind === "flame") drawBeaconFlame(c, light, sample, strength);
      else {
        lightBloom(c, light.x, light.y, 9, sample.color, strength * 0.65);
        c.fillStyle = `rgba(255,248,226,${strength})`;
        c.beginPath();
        c.ellipse(
          light.x,
          light.y,
          sample.lampRadius,
          sample.lampRadius * 0.65,
          0,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
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
    const { glowRadius, kind } = sampleLighthouse(0, light.index);
    lightBloom(
      d,
      light.x,
      light.y + 5,
      glowRadius * 1.8,
      "0,0,0",
      lighting.night * (kind === "flame" ? 0.48 : 0.38),
      0.5,
    );
  }
  d.globalCompositeOperation = "source-over";
}

export function drawShipLanterns(c, ship, lighting) {
  if (lighting.night < 0.08) return;
  c.save();
  c.globalCompositeOperation = "screen";
  const lanternGlowStyle = `rgba(255,187,75,${lighting.night * 0.55})`;
  const lanternLampStyle = `rgba(255,237,167,${lighting.night * 0.95})`;
  for (const offset of [-13, 13]) {
    const x = ship.x + Math.cos(ship.angle) * offset;
    const y = ship.y + Math.sin(ship.angle) * offset * 0.9;
    glow(c, x, y, 35, lanternGlowStyle);
    c.fillStyle = lanternLampStyle;
    c.beginPath();
    c.arc(x, y, 2.2, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}
