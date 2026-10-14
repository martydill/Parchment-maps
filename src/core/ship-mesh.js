// Low-poly 3D vessel, boat, and harbor meshes built from the shared ship
// model profiles. Everything is deterministic flat-shaded triangle soup with
// per-vertex paint colors and a "sway" weight the renderer animates on sails,
// yards, and pennants. Mesh space: forward +x, port +y, up +z; sizes follow
// the profile's world units so vessels keep their chart proportions.

// Warm parchment-chart pigments: bright enough to read as painted art at
// chart distance while keeping the inked dark waterline and rigging.
export const VESSEL_PALETTE = Object.freeze({
  hull: [0.62, 0.44, 0.26],
  keel: [0.36, 0.25, 0.15],
  deck: [0.78, 0.62, 0.4],
  bulwark: [0.5, 0.36, 0.21],
  mast: [0.55, 0.4, 0.24],
  yard: [0.46, 0.34, 0.2],
  sail: [0.98, 0.94, 0.83],
  sailShade: [0.88, 0.82, 0.68],
  cabin: [0.63, 0.47, 0.29],
  cabinRoof: [0.68, 0.4, 0.25],
  pennant: [0.76, 0.35, 0.24],
  oar: [0.55, 0.42, 0.26],
  gun: [0.28, 0.24, 0.2],
  stone: [0.9, 0.85, 0.71],
  roof: [0.66, 0.39, 0.24],
  lantern: [1, 0.85, 0.55],
});

const STRIDE = 10;

function meshBuilder() {
  const positions = [];
  const push = (points, normal, color, swayValues) => {
    points.forEach(([x, y, z], index) => {
      const sway = Array.isArray(swayValues)
        ? swayValues[index]
        : swayValues || 0;
      positions.push(
        x,
        y,
        z,
        normal[0],
        normal[1],
        normal[2],
        color[0],
        color[1],
        color[2],
        sway,
      );
    });
  };
  const tri = (a, b, c, color, sway = 0) => {
    push([a, b, c], faceNormal(a, b, c), color, sway);
  };
  const quad = (a, b, c, d, color, sway = 0, swayMap = null) => {
    const n = faceNormal(a, b, c);
    const sways = swayMap
      ? [swayMap(a), swayMap(b), swayMap(c), swayMap(d)]
      : sway;
    push([a, b, c], n, color, sways);
    push([a, c, d], n, color, sways);
  };
  return { positions, push, tri, quad };
}

function faceNormal(a, b, c) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz) || 1;
  return [nx / length, ny / length, nz / length];
}

function box(builder, color, cy0, cy1, z0, z1, x0, x1) {
  const a = [x0, cy0, z0];
  const b = [x1, cy0, z0];
  const c = [x1, cy1, z0];
  const d = [x0, cy1, z0];
  const e = [x0, cy0, z1];
  const f = [x1, cy0, z1];
  const g = [x1, cy1, z1];
  const h = [x0, cy1, z1];
  builder.quad(d, c, g, h, color);
  builder.quad(b, a, e, f, color);
  builder.quad(a, d, h, e, color);
  builder.quad(c, b, f, g, color);
  builder.quad(e, h, g, f, color);
  builder.quad(a, b, c, d, color);
}

// Hull cross-section ring at station t (0 = bow, 1 = stern). Returns points
// from port deck edge down around the keel to starboard deck edge.
function hullSection(profile, t, x) {
  const { beam, deckHeight, sternRise, bowRise } = profile;
  const shape = Math.sin(
    Math.PI * Math.min(1, Math.max(0.04, t * 0.92 + 0.04)),
  );
  const taper = t < 0.5 ? 0.55 + 0.9 * t : 1.08 - 0.2 * (t - 0.5);
  const half = (beam / 2) * Math.min(shape * 1.1, taper, 1);
  const rise =
    (t < 0.22 ? bowRise * (1 - t / 0.22) ** 1.6 : 0) +
    (t > 0.78 ? sternRise * ((t - 0.78) / 0.22) ** 1.4 : 0);
  const deckZ = deckHeight * 0.6 + rise;
  const keelZ = -beam * 0.52 * (t < 0.14 ? 1 - t / 0.14 : 1);
  const waterlineZ = keelZ * 0.35;
  return {
    x,
    deckZ,
    keelZ,
    waterlineZ,
    half,
    deckPort: [x, half, deckZ],
    railPort: [x, half * 1.04, deckZ + profile.beam * 0.12],
    waterPort: [x, half * 0.92, waterlineZ],
    keelPoint: [x, 0, keelZ],
    waterStar: [x, -half * 0.92, waterlineZ],
    railStar: [x, -half * 1.04, deckZ + profile.beam * 0.12],
    deckStar: [x, -half, deckZ],
  };
}

function buildHull(builder, profile, palette) {
  const stations = 9;
  let previous = null;
  for (let s = 0; s <= stations; s++) {
    const t = s / stations;
    const section = hullSection(
      profile,
      t,
      -profile.length / 2 + t * profile.length,
    );
    if (previous) {
      // Port hull side.
      builder.quad(
        previous.deckPort,
        section.deckPort,
        section.waterPort,
        previous.waterPort,
        palette.hull,
      );
      builder.quad(
        previous.waterPort,
        section.waterPort,
        section.keelPoint,
        previous.keelPoint,
        palette.keel,
      );
      // Starboard hull side.
      builder.quad(
        section.deckStar,
        previous.deckStar,
        previous.waterStar,
        section.waterStar,
        palette.hull,
      );
      builder.quad(
        section.waterStar,
        previous.waterStar,
        previous.keelPoint,
        section.keelPoint,
        palette.keel,
      );
      // Deck and bulwarks.
      builder.quad(
        section.deckStar,
        previous.deckStar,
        previous.deckPort,
        section.deckPort,
        palette.deck,
      );
      builder.quad(
        previous.railPort,
        section.railPort,
        section.deckPort,
        previous.deckPort,
        palette.bulwark,
      );
      builder.quad(
        section.railStar,
        previous.railStar,
        previous.deckStar,
        section.deckStar,
        palette.bulwark,
      );
    }
    previous = section;
  }
  // Transom closes the stern.
  const stern = hullSection(profile, 1, profile.length / 2);
  builder.tri(stern.deckPort, stern.deckStar, stern.waterPort, palette.hull);
  builder.tri(stern.deckStar, stern.waterStar, stern.waterPort, palette.hull);
  const bow = hullSection(profile, 0, -profile.length / 2);
  builder.tri(bow.deckPort, bow.deckStar, bow.railPort, palette.bulwark);
  builder.tri(bow.deckStar, bow.railStar, bow.railPort, palette.bulwark);
}

function buildMastsAndSails(builder, profile, palette, billow) {
  const mastWidth = Math.max(0.7, profile.beam * 0.09);
  for (const mast of profile.masts) {
    const x = mast.y;
    const baseZ = profile.deckHeight * 0.6;
    box(
      builder,
      palette.mast,
      -mastWidth / 2,
      mastWidth / 2,
      baseZ,
      baseZ + mast.height,
      x - mastWidth / 2,
      x + mastWidth / 2,
    );
    const sailCount = Math.max(1, mast.sails || 1);
    if (profile.rig === "lateen") {
      buildLateenSail(builder, palette, {
        x,
        baseZ,
        topZ: baseZ + mast.height,
        yard: mast.yard,
        bow: profile.bow,
        billow,
      });
    } else if (profile.rig === "gaff") {
      buildGaffSail(builder, palette, {
        x,
        baseZ,
        topZ: baseZ + mast.height,
        yard: mast.yard,
        billow,
      });
    } else {
      buildSquareSails(builder, palette, {
        x,
        baseZ,
        topZ: baseZ + mast.height,
        yard: mast.yard,
        count: sailCount,
        billow,
      });
    }
  }
}

// A yards-and-squares rig: each sail hangs between two horizontal yards and
// billies aft in a smooth curve. Yards are drawn as slim boxes.
function buildSquareSails(
  builder,
  palette,
  { x, baseZ, topZ, yard, count, billow },
) {
  const usable = topZ - baseZ;
  const levels = [];
  for (let s = 0; s <= count; s++) {
    levels.push(baseZ + usable * (0.22 + (0.78 * s) / count));
  }
  for (let s = 0; s < count; s++) {
    const z0 = levels[s];
    const z1 = levels[s + 1];
    const half = (yard / 2) * (0.92 - 0.1 * (s / count));
    buildBillowedSail(builder, palette, {
      across0: -half,
      across1: half,
      z0,
      z1,
      billow: billow * (0.8 + 0.4 * (s / Math.max(1, count - 1))),
      swayBase: 0.35 + 0.4 * (s / Math.max(1, count - 1)),
    });
    // Yard spar across the sail head.
    box(
      builder,
      palette.yard,
      -half,
      half,
      z1 - 0.3,
      z1 + 0.3,
      x - 0.4,
      x + 0.4,
    );
  }
}

// One curved sail panel between two horizontal edges, bulging aft (-x).
function buildBillowedSail(
  builder,
  palette,
  { across0, across1, z0, z1, billow, swayBase },
) {
  const columns = 5;
  const rows = 3;
  const point = (u, v) => {
    const y = across0 + (across1 - across0) * u;
    const z = z0 + (z1 - z0) * v;
    const bulge =
      billow * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * (z1 - z0) * 0.3;
    return [-bulge, y, z];
  };
  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      const u0 = i / columns;
      const u1 = (i + 1) / columns;
      const v0 = j / rows;
      const v1 = (j + 1) / rows;
      const shade = (u0 + u1) / 2 < 0.5 ? palette.sail : palette.sailShade;
      const sway = (v) => Math.min(1, swayBase + v * 0.55);
      builder.quad(
        point(u0, v0),
        point(u1, v0),
        point(u1, v1),
        point(u0, v1),
        shade,
        [sway(v0), sway(v0), sway(v1), sway(v1)],
      );
    }
  }
}

function buildLateenSail(
  builder,
  palette,
  { x, baseZ, topZ, yard, bow, billow },
) {
  // A long tilted yard swings from the mast top forward past the bow; the
  // sail hangs between yard and a low foot line running aft.
  const yardTip = [x + yard * 0.62, 0, baseZ + (topZ - baseZ) * 0.55];
  const yardAft = [x - yard * 0.52, 0, topZ];
  box(
    builder,
    palette.yard,
    -0.35,
    0.35,
    Math.min(yardTip[2], yardAft[2]),
    Math.max(yardTip[2], yardAft[2]) + 0.5,
    Math.min(yardTip[0], yardAft[0]),
    Math.max(yardTip[0], yardAft[0]),
  );
  void bow;
  const footAft = [x - yard * 0.4, 0, baseZ + 1];
  const footFore = [x + yard * 0.42, 0, baseZ + 2.2];
  const columns = 4;
  const rows = 3;
  const point = (u, v) => {
    // v climbs from the foot line to the yard.
    const edge0 = [
      footFore[0] + (footAft[0] - footFore[0]) * u,
      0,
      footFore[2] + (footAft[2] - footFore[2]) * u,
    ];
    const edge1 = [
      yardTip[0] + (yardAft[0] - yardTip[0]) * u,
      0,
      yardTip[2] + (yardAft[2] - yardTip[2]) * u,
    ];
    const bulge = billow * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * 2.4;
    return [
      edge0[0] + (edge1[0] - edge0[0]) * v - bulge,
      0,
      edge0[2] + (edge1[2] - edge0[2]) * v,
    ];
  };
  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      const u0 = i / columns;
      const u1 = (i + 1) / columns;
      const v0 = j / rows;
      const v1 = (j + 1) / rows;
      builder.quad(
        point(u0, v0),
        point(u1, v0),
        point(u1, v1),
        point(u0, v1),
        v0 > 0.5 ? palette.sailShade : palette.sail,
        [
          0.4 + v1 * 0.5,
          0.4 + v1 * 0.5,
          Math.min(1, 0.4 + v1 * 0.5),
          Math.min(1, 0.4 + v1 * 0.5),
        ],
      );
    }
  }
}

function buildGaffSail(builder, palette, { x, baseZ, topZ, yard, billow }) {
  const peak = [x - yard * 0.55, 0, topZ - (topZ - baseZ) * 0.12];
  const throat = [x, 0, topZ - (topZ - baseZ) * 0.3];
  const clew = [x - yard * 0.48, 0, baseZ + (topZ - baseZ) * 0.16];
  const tack = [x, 0, baseZ + (topZ - baseZ) * 0.08];
  const columns = 3;
  const rows = 3;
  const point = (u, v) => {
    const head = [
      throat[0] + (peak[0] - throat[0]) * u,
      0,
      throat[2] + (peak[2] - throat[2]) * u,
    ];
    const foot = [
      tack[0] + (clew[0] - tack[0]) * u,
      0,
      tack[2] + (clew[2] - tack[2]) * u,
    ];
    const bulge = billow * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * 2;
    return [
      head[0] + (foot[0] - head[0]) * v - bulge,
      0,
      head[2] + (foot[2] - head[2]) * v,
    ];
  };
  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      const u0 = i / columns;
      const u1 = (i + 1) / columns;
      const v0 = j / rows;
      const v1 = (j + 1) / rows;
      builder.quad(
        point(u0, v0),
        point(u1, v0),
        point(u1, v1),
        point(u0, v1),
        u0 > 0.5 ? palette.sailShade : palette.sail,
        0,
        (_p) => Math.min(1, 0.4 + v1 * 0.5),
      );
    }
  }
}

function buildCabin(builder, profile, palette) {
  const size =
    { small: 0.7, tiny: 0.5, high: 1.15, survey: 0.85 }[profile.cabin] || 0.7;
  const length = profile.length * 0.16 * (size + 0.5);
  const width = profile.beam * 0.62;
  const x0 = profile.length / 2 - profile.length * 0.14 - length;
  const z0 = profile.deckHeight * 0.6;
  const z1 = z0 + profile.deckHeight * (0.4 + size * 0.35);
  box(builder, palette.cabin, -width / 2, width / 2, z0, z1, x0, x0 + length);
  // Roof prism.
  const ridge = (x0 + x0 + length) / 2;
  builder.quad(
    [x0, width / 2, z1],
    [x0 + length, width / 2, z1],
    [ridge, 0, z1 + profile.beam * 0.16],
    [x0, width / 2, z1],
    palette.cabinRoof,
  );
  builder.quad(
    [x0 + length, -width / 2, z1],
    [x0, -width / 2, z1],
    [ridge, 0, z1 + profile.beam * 0.16],
    [x0 + length, -width / 2, z1],
    palette.cabinRoof,
  );
}

function buildPennant(builder, profile, palette) {
  const mast = profile.masts[0];
  const topZ = profile.deckHeight * 0.6 + mast.height;
  const x = mast.y;
  const drop = Math.max(2.4, profile.length * 0.09);
  builder.tri(
    [x, 0, topZ + 0.6],
    [x, 0, topZ - drop],
    [x - drop * 0.85, 0, topZ - drop * 0.42],
    palette.pennant,
    1,
  );
}

function buildOutrigger(builder, profile, palette) {
  const length = profile.length * 0.7;
  const x0 = -length / 2 + profile.length * 0.1;
  const y = profile.beam * 1.05;
  for (const side of [y, -y]) {
    box(
      builder,
      palette.oar,
      side - 0.4,
      side + 0.4,
      0.2,
      0.8,
      x0,
      x0 + length,
    );
  }
  // Crossbeams tying the float to the hull.
  for (const bx of [-length * 0.3, length * 0.25]) {
    box(builder, palette.oar, -y, y, 0.6, 1.2, bx, bx + 1.1);
  }
}

function buildGuns(builder, profile, palette) {
  const count = 4;
  for (let i = 0; i < count; i++) {
    const x = -profile.length * 0.3 + (i * profile.length * 0.6) / (count - 1);
    const y = profile.beam * 0.5;
    box(
      builder,
      palette.gun,
      y - 0.6,
      y + 0.6,
      profile.deckHeight * 0.6 + 1.2,
      profile.deckHeight * 0.6 + 2,
      x - 0.7,
      x + 0.7,
    );
    box(
      builder,
      palette.gun,
      -y - 0.6,
      -y + 0.6,
      profile.deckHeight * 0.6 + 1.2,
      profile.deckHeight * 0.6 + 2,
      x - 0.7,
      x + 0.7,
    );
  }
}

export function buildVesselMesh(
  profile,
  { palette = VESSEL_PALETTE, billow = 1 } = {},
) {
  const builder = meshBuilder();
  buildHull(builder, profile, palette);
  buildMastsAndSails(builder, profile, palette, billow);
  buildCabin(builder, profile, palette);
  buildPennant(builder, profile, palette);
  if (profile.outrigger) buildOutrigger(builder, profile, palette);
  if (profile.guns) buildGuns(builder, profile, palette);
  return finalizeMesh(builder.positions);
}

// A small open boat used for fishing fleets and harbor traffic.
export function buildRowboatMesh({
  length = 15,
  beam = 4.6,
  palette = VESSEL_PALETTE,
} = {}) {
  const builder = meshBuilder();
  const profile = {
    length,
    beam,
    deckHeight: 2.4,
    sternRise: 0.4,
    bowRise: 0.9,
    bow: -length / 2,
    stern: length / 2,
    masts: [],
  };
  buildHull(builder, profile, palette);
  // Thwart benches.
  for (const x of [-length * 0.22, length * 0.12]) {
    box(
      builder,
      palette.oar,
      -beam * 0.3,
      beam * 0.3,
      profile.deckHeight * 0.6,
      profile.deckHeight * 0.6 + 0.5,
      x - 0.4,
      x + 0.4,
    );
  }
  return finalizeMesh(builder.positions);
}

// Harbor lighthouse: tapered banded tower, gallery, lamp room, and cone cap.
export function buildLighthouseMesh({
  height = 46,
  baseRadius = 4.4,
  palette = VESSEL_PALETTE,
} = {}) {
  const builder = meshBuilder();
  const sides = 8;
  const topRadius = baseRadius * 0.55;
  const galleryZ = height * 0.72;
  const levels = [0, galleryZ * 0.5, galleryZ];
  for (let l = 0; l + 1 < levels.length; l++) {
    const z0 = levels[l];
    const z1 = levels[l + 1];
    const r0 = baseRadius + (topRadius - baseRadius) * (z0 / galleryZ);
    const r1 = baseRadius + (topRadius - baseRadius) * (z1 / galleryZ);
    const color = l % 2 === 0 ? palette.stone : palette.pennant;
    for (let s = 0; s < sides; s++) {
      const a0 = (s / sides) * Math.PI * 2;
      const a1 = ((s + 1) / sides) * Math.PI * 2;
      builder.quad(
        [Math.cos(a0) * r0, Math.sin(a0) * r0, z0],
        [Math.cos(a1) * r0, Math.sin(a1) * r0, z0],
        [Math.cos(a1) * r1, Math.sin(a1) * r1, z1],
        [Math.cos(a0) * r1, Math.sin(a0) * r1, z1],
        color,
      );
    }
  }
  // Gallery deck, lamp room, and cap.
  const r = topRadius * 1.45;
  for (let s = 0; s < sides; s++) {
    const a0 = (s / sides) * Math.PI * 2;
    const a1 = ((s + 1) / sides) * Math.PI * 2;
    builder.quad(
      [Math.cos(a0) * topRadius, Math.sin(a0) * topRadius, galleryZ],
      [Math.cos(a1) * topRadius, Math.sin(a1) * topRadius, galleryZ],
      [Math.cos(a1) * r, Math.sin(a1) * r, galleryZ],
      [Math.cos(a0) * r, Math.sin(a0) * r, galleryZ],
      palette.stone,
    );
    builder.quad(
      [Math.cos(a0) * r, Math.sin(a0) * r, galleryZ],
      [Math.cos(a1) * r, Math.sin(a1) * r, galleryZ],
      [Math.cos(a1) * r, Math.sin(a1) * r, galleryZ + 3],
      [Math.cos(a0) * r, Math.sin(a0) * r, galleryZ + 3],
      palette.lantern,
    );
    builder.quad(
      [Math.cos(a0) * r, Math.sin(a0) * r, galleryZ + 3],
      [Math.cos(a1) * r, Math.sin(a1) * r, galleryZ + 3],
      [Math.cos(a1) * r * 0.5, Math.sin(a1) * r * 0.5, galleryZ + 6.5],
      [Math.cos(a0) * r * 0.5, Math.sin(a0) * r * 0.5, galleryZ + 6.5],
      palette.roof,
    );
  }
  return finalizeMesh(builder.positions);
}

// A deterministic cluster of harbor buildings and a stone pier for ports.
export function buildPortClusterMesh({
  seed = 1,
  houses = 5,
  palette = VESSEL_PALETTE,
} = {}) {
  const builder = meshBuilder();
  const random = (n) => {
    let h = Math.imul(n ^ seed, 2654435761);
    h = Math.imul(h ^ (h >>> 13), 1597334677);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < houses; i++) {
    const w = 5 + random(i * 3 + 1) * 6;
    const d = 5 + random(i * 3 + 2) * 6;
    const h = 5 + random(i * 3 + 3) * 7;
    const x = (random(i * 7 + 4) - 0.5) * 58;
    const y = (random(i * 7 + 5) - 0.5) * 40;
    box(
      builder,
      palette.stone,
      y - d / 2,
      y + d / 2,
      0,
      h,
      x - w / 2,
      x + w / 2,
    );
    const ridgeZ = h + Math.min(w, d) * 0.35;
    builder.quad(
      [x - w / 2, y + d / 2, h],
      [x + w / 2, y + d / 2, h],
      [x + w / 2 - w * 0.5, y, ridgeZ],
      [x - w / 2, y + d / 2, h],
      palette.roof,
    );
    builder.quad(
      [x + w / 2, y - d / 2, h],
      [x - w / 2, y - d / 2, h],
      [x - w / 2 + w * 0.5, y, ridgeZ],
      [x + w / 2, y - d / 2, h],
      palette.roof,
    );
  }
  // Stone pier reaching toward the water.
  box(builder, palette.stone, 8, 26, -1.5, 2.2, -8, 8);
  return finalizeMesh(builder.positions);
}

// Domes for the leviathan encounter, one hump per count along x.
export function buildCreatureHumpsMesh({ count = 4, radius = 9 } = {}) {
  const builder = meshBuilder();
  const body = [0.23, 0.3, 0.27];
  const fin = [0.18, 0.24, 0.22];
  for (let hump = 0; hump < count; hump++) {
    const cx = (hump - (count - 1) / 2) * radius * 1.7;
    const scale = 1 - Math.abs(hump - (count - 1) / 2) * 0.18;
    const rings = 3;
    const segments = 8;
    for (let ring = 0; ring < rings; ring++) {
      const z0 = (ring / rings) * radius * scale;
      const z1 = ((ring + 1) / rings) * radius * scale;
      const r0 =
        radius *
        scale *
        Math.sqrt(Math.max(0.0001, 1 - (z0 / (radius * scale)) ** 2));
      const r1 =
        radius *
        scale *
        Math.sqrt(Math.max(0.0001, 1 - (z1 / (radius * scale)) ** 2));
      for (let s = 0; s < segments; s++) {
        const a0 = (s / segments) * Math.PI * 2;
        const a1 = ((s + 1) / segments) * Math.PI * 2;
        builder.quad(
          [cx + Math.cos(a0) * r0, Math.sin(a0) * r0, z0],
          [cx + Math.cos(a1) * r0, Math.sin(a1) * r0, z0],
          [cx + Math.cos(a1) * r1, Math.sin(a1) * r1, z1],
          [cx + Math.cos(a0) * r1, Math.sin(a0) * r1, z1],
          ring > 1 ? fin : body,
        );
      }
    }
  }
  return finalizeMesh(builder.positions);
}

function finalizeMesh(positions) {
  const data = new Float32Array(positions);
  let minSway = 1;
  let maxSway = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  for (let v = 0; v < data.length / STRIDE; v++) {
    const sway = data[v * STRIDE + 9];
    minSway = Math.min(minSway, sway);
    maxSway = Math.max(maxSway, sway);
    minX = Math.min(minX, data[v * STRIDE]);
    maxX = Math.max(maxX, data[v * STRIDE]);
  }
  return {
    data,
    vertexCount: data.length / STRIDE,
    swayRange: [minSway, maxSway],
    extentX: [minX, maxX],
  };
}
