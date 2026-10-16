import { clamp, nearestWrapped } from "./math.js";
import { pointInPolygon } from "./geometry.js";
import { currentAtPosition } from "./maritime-hazards.js";

const STEP = 1 / 20;
const noise = (seed) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

// Match the miniature's ground-plane rotation and scale, including nested dock
// frames. Heights are deliberately omitted: foam meets the submerged footprint.
export function harborFoamObstacles(layout, placement) {
  if (!layout || !placement) return [];
  const angle = placement.heading + layout.angle;
  const scale = placement.scale * layout.scale;
  const project = ([u, v]) => [
    placement.x + (u * Math.cos(angle) - v * Math.sin(angle)) * scale,
    placement.y + (u * Math.sin(angle) + v * Math.cos(angle)) * scale,
  ];
  const box = ([u, v, w, d, turn]) => {
    return [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ].map(([x, y]) => [
      u + x * Math.cos(turn) - y * Math.sin(turn),
      v + x * Math.sin(turn) + y * Math.cos(turn),
    ]);
  };
  return [
    ...layout.grounds.map(({ outline }) => outline),
    ...layout.docks.map(box),
    ...(layout.walls ?? []).map(box),
  ].map((outline) => ({ poly: outline.map(project), kind: "harbor" }));
}

// Static spatial index of waterline segments and convex separation points.
// Subdivision bounds each lookup to nine small cells, even on the full atlas.
export function createObstacleFlow(obstacles, worldWidth, currents = []) {
  const columns = Math.max(1, Math.ceil(worldWidth / 64));
  const cell = worldWidth / columns;
  const grid = new Map();
  const neighborhoods = new Map();
  const sources = [];
  // Row-stride IDs avoid allocating grid-key strings for every particle.
  const key = (x, y) => y * columns + (((x % columns) + columns) % columns);
  const insert = (entry) => {
    const id = key(Math.floor(entry.x / cell), Math.floor(entry.y / cell));
    if (!grid.has(id)) grid.set(id, []);
    grid.get(id).push(entry);
  };
  for (const { poly, depth = 0, kind = "rock" } of obstacles) {
    if (poly.length < 3) continue;
    const points = poly.map(([x, y]) => [x, y + depth]);
    const area = points.reduce((sum, [x, y], i) => {
      const next = points[(i + 1) % points.length];
      return sum + x * next[1] - next[0] * y;
    }, 0);
    if (Math.abs(area) < 0.001) continue;
    const facing = Math.sign(area);
    const center = points.reduce(
      (sum, [x, y]) => [sum[0] + x / points.length, sum[1] + y / points.length],
      [0, 0],
    );
    const edges = points.map(([x, y], i) => {
      const b = points[(i + 1) % points.length];
      const length = Math.hypot(b[0] - x, b[1] - y);
      const tx = (b[0] - x) / (length || 1),
        ty = (b[1] - y) / (length || 1);
      return { x, y, length, tx, ty, nx: ty * facing, ny: -tx * facing };
    });
    for (const [i, edge] of edges.entries()) {
      if (edge.length < 0.01) continue;
      const previous = edges[(i - 1 + edges.length) % edges.length];
      const turn = (previous.tx * edge.ty - previous.ty * edge.tx) * facing;
      if (turn > 0.12 && kind !== "solid") {
        const length = Math.hypot(previous.nx + edge.nx, previous.ny + edge.ny);
        insert({
          x: edge.x,
          y: edge.y,
          vortex: true,
          nx: (previous.nx + edge.nx) / length,
          ny: (previous.ny + edge.ny) / length,
          radius: clamp(
            Math.min(previous.length, edge.length) * 0.65,
            6,
            kind === "harbor" ? 10 : 24,
          ),
        });
      }
      const count = Math.ceil(edge.length / 16);
      for (let part = 0; part < count; part++) {
        const length = edge.length / count;
        const ax = edge.x + edge.tx * length * part,
          ay = edge.y + edge.ty * length * part;
        const entry = {
          ...edge,
          ax,
          ay,
          length,
          x: ax + (edge.tx * length) / 2,
          y: ay + (edge.ty * length) / 2,
          split:
            Math.sign(
              (ax - center[0]) * edge.tx + (ay - center[1]) * edge.ty,
            ) || 1,
        };
        insert(entry);
        if (part % 2 === 0 && kind !== "marsh" && kind !== "solid")
          sources.push({ ...entry, seed: sources.length + 1, kind });
      }
    }
  }
  // Hidden emitters at overlapping island/harbor footprints must not seed foam.
  const bounds = obstacles
    .filter(({ poly }) => poly.length >= 3)
    .map(({ poly, depth = 0 }) => ({
      poly,
      depth,
      left: Math.min(...poly.map(([x]) => x)),
      right: Math.max(...poly.map(([x]) => x)),
      top: Math.min(...poly.map(([, y]) => y)),
      bottom: Math.max(...poly.map(([, y]) => y)),
    }));
  const contains = (x, y) =>
    bounds.some(({ poly, depth, left, right, top, bottom }) => {
      const center = (left + right) / 2;
      const px = x - (nearestWrapped(center, x, worldWidth) - center),
        py = y - depth;
      return (
        px >= left &&
        px <= right &&
        py >= top &&
        py <= bottom &&
        pointInPolygon(px, py, poly)
      );
    });
  const emitters = sources.filter(
    (s) => !contains(s.x + s.nx * 3, s.y + s.ny * 3),
  );

  function neighborhood(column, row) {
    const id = key(column, row);
    let entries = neighborhoods.get(id);
    if (entries) return entries;
    entries = [];
    const visited = new Set();
    // Geometry is static, so particles in the same cell share these nine
    // buckets. Preserve their order and deduplicate narrow wrapped worlds.
    for (let ix = column - 1; ix <= column + 1; ix++) {
      for (let iy = row - 1; iy <= row + 1; iy++) {
        const neighbor = key(ix, iy);
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        for (const entry of grid.get(neighbor) ?? []) entries.push(entry);
      }
    }
    // Keep the cache bounded as voyages move through new coastlines.
    if (neighborhoods.size >= 256)
      neighborhoods.delete(neighborhoods.keys().next().value);
    neighborhoods.set(id, entries);
    return entries;
  }

  function sample(x, y, windAngle, roughness) {
    const current = currentAtPosition({ x, y }, currents, worldWidth);
    const speed = 4 + clamp(roughness, 0, 1) * 4;
    let vx = Math.cos(windAngle) * speed + current.x * 11;
    let vy = Math.sin(windAngle) * speed + current.y * 11;
    const flowX = vx,
      flowY = vy;
    const magnitude = Math.hypot(vx, vy) || 1;
    let nearest = null;
    const column = Math.floor(x / cell),
      row = Math.floor(y / cell);
    for (const s of neighborhood(column, row)) {
      const px = nearestWrapped(s.x, x, worldWidth);
      if (s.vortex) {
        const downstream = (flowX * s.nx + flowY * s.ny) / magnitude;
        if (downstream <= 0.12) continue;
        const dx = x - px - s.nx * s.radius * 1.35,
          dy = y - s.y - s.ny * s.radius * 1.35;
        const r = Math.hypot(dx, dy) / s.radius;
        if (r >= 2.6) continue;
        const spin = Math.sign(flowX * s.ny - flowY * s.nx) || 1;
        const strength = Math.exp(-r * r * 0.65) * downstream;
        vx += ((-dy / s.radius) * spin * 19 - flowX * 0.7) * strength;
        vy += ((dx / s.radius) * spin * 19 - flowY * 0.7) * strength;
        continue;
      }
      const ax = px - (s.tx * s.length) / 2;
      const ay = s.ay;
      const along = clamp((x - ax) * s.tx + (y - ay) * s.ty, 0, s.length);
      const qx = ax + s.tx * along,
        qy = ay + s.ty * along;
      const dx = x - qx,
        dy = y - qy,
        distance = Math.hypot(dx, dy);
      if (distance < 42 && (!nearest || distance < nearest.distance))
        nearest = { s, distance, qx, qy, side: dx * s.nx + dy * s.ny };
    }
    if (nearest) {
      const { s, distance } = nearest;
      const influence = (1 - distance / 42) ** 2;
      const normal = vx * s.nx + vy * s.ny;
      // Remove incoming flow, accelerate tangentially, and split stagnation
      // points toward opposite ends of the obstacle instead of sticking there.
      const tangent = flowX * s.tx + flowY * s.ty;
      const slip = Math.abs(tangent) < 1.2 ? s.split * 3 : tangent * 0.35;
      vx += (-s.nx * Math.min(0, normal) + s.tx * slip) * influence;
      vy += (-s.ny * Math.min(0, normal) + s.ty * slip) * influence;
    }
    return { vx, vy, nearest };
  }
  return { emitters, contains, sample };
}

// Visual state only: fixed steps preserve a parcel's history through gusts and
// render cadence changes. Catch-up, lifetime, trails, and population are bounded.
export function createObstacleFoam(flow, worldWidth) {
  let particles = [];
  let previous;
  let previousEmitters = [];
  let clock = 0;
  let serial = 0;
  let carry = 0;
  const nearby = (p, view, margin = 100) => {
    const x = nearestWrapped(p.x, (view.left + view.right) / 2, worldWidth);
    return (
      x >= view.left - margin &&
      x <= view.right + margin &&
      p.y >= view.top - margin &&
      p.y <= view.bottom + margin
    );
  };
  function step(dt, emitters, options, limit) {
    clock += dt;
    carry +=
      dt *
      (12 + options.roughness * 14) *
      (0.45 + (options.detail ?? 1) * 0.55) *
      Math.min(1, emitters.length / 12);
    while (carry >= 1 && emitters.length && particles.length < limit) {
      carry--;
      const source = emitters[Math.floor(noise(serial + 19) * emitters.length)];
      const grain = noise(++serial + source.seed);
      const spread = (grain - 0.5) * source.length;
      const x = source.x + source.nx * (2.5 + grain * 5) + source.tx * spread;
      const y = source.y + source.ny * (2.5 + grain * 5) + source.ty * spread;
      if (flow.contains(x, y)) continue;
      particles.push({
        x,
        y,
        age: 0,
        life: 8 + grain * 9,
        grain,
        trail: [{ x, y }],
        vx: 0,
        vy: 0,
      });
    }
    carry = Math.min(carry, 1);
    particles = particles.filter((p) => {
      p.age += dt;
      if (p.age >= p.life || !nearby(p, options.view)) return false;
      const { vx, vy, nearest } = flow.sample(
        p.x,
        p.y,
        options.windAngle,
        options.roughness,
      );
      const inertia = 1 - Math.exp(-dt * 3);
      p.vx += (vx - p.vx) * inertia;
      p.vy += (vy - p.vy) * inertia;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (nearest && nearest.side < 2) {
        const { s, qx, qy } = nearest;
        p.x = qx + s.nx * 2.2;
        p.y = qy + s.ny * 2.2;
        const inward = Math.min(0, p.vx * s.nx + p.vy * s.ny);
        p.vx -= s.nx * inward;
        p.vy -= s.ny * inward;
      }
      if (Math.floor(clock * 5) !== Math.floor((clock - dt) * 5)) {
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 12) p.trail.shift();
      }
      return true;
    });
  }
  return {
    update(time, options) {
      const limit = Math.round(280 + clamp(options.detail ?? 1, 0, 1) * 440);
      const emitters = flow.emitters.filter((s) => nearby(s, options.view, 60));
      const changedEmitters =
        previousEmitters.length !== emitters.length ||
        emitters.some((emitter, index) => emitter !== previousEmitters[index]);
      // A frozen sea still needs an established foam pattern when panning to
      // new shores; unchanged emitters retain exactly the same snapshot.
      if (
        previous === undefined ||
        time < previous ||
        (time === previous && changedEmitters)
      ) {
        particles = [];
        carry = 0;
        serial = 0;
        clock = 0;
        for (let warm = 0; warm < 80; warm++)
          step(STEP, emitters, options, limit);
        previous = time;
      }
      const elapsed = Math.min(0.25, Math.max(0, time - previous));
      const steps = Math.floor((elapsed + 1e-8) / STEP);
      for (let i = 0; i < steps; i++) step(STEP, emitters, options, limit);
      previous = time - (elapsed - steps * STEP);
      particles = particles
        .filter((p) => nearby(p, options.view))
        .slice(0, limit);
      previousEmitters = emitters;
      return particles;
    },
  };
}
