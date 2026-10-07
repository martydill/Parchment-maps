import { mapOpeningFrame } from "./core/map-opening.js";

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function seededRandom(initialSeed) {
  let seed = initialSeed;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const TEXTURE_URLS = {
  table: "./assets/map-opening/table-weathered.jpg",
  paper: "./assets/map-opening/parchment-weathered.jpg",
};

function loadTexture(url) {
  return new Promise((resolve) => {
    const image = new Image();
    const timeout = setTimeout(() => resolve(null), 2500);
    const finish = (texture) => {
      clearTimeout(timeout);
      resolve(texture);
    };
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.src = url;
  });
}

function createTable(texture) {
  const canvas = makeCanvas(
    texture?.naturalWidth || 1200,
    texture?.naturalHeight || 900,
  );
  const c = canvas.getContext("2d");
  c.fillStyle = "#45382b";
  c.fillRect(0, 0, canvas.width, canvas.height);
  if (texture) c.drawImage(texture, 0, 0, canvas.width, canvas.height);
  c.save();
  c.scale(canvas.width / 1200, canvas.height / 900);
  const light = c.createRadialGradient(260, 140, 20, 510, 400, 850);
  light.addColorStop(0, "rgba(235,175,100,.04)");
  light.addColorStop(0.5, "rgba(24,13,8,.12)");
  light.addColorStop(1, "rgba(5,3,2,.68)");
  c.fillStyle = light;
  c.fillRect(0, 0, 1200, 900);
  c.restore();
  return canvas;
}

function createPaperTexture(texture) {
  const canvas = makeCanvas(1000, 750);
  const c = canvas.getContext("2d");
  c.fillStyle = "#c7a875";
  c.fillRect(0, 0, canvas.width, canvas.height);
  if (texture) c.drawImage(texture, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function createTatteredEdges() {
  const random = seededRandom(5719);
  return Array.from({ length: 2 }, () => {
    const points = [{ u: 0, depth: 36 }];
    let u = 0.006;
    while (u < 0.99) {
      const depth = 3 + random() * 5;
      points.push({ u, depth });
      if (random() < 0.09) {
        const bite = 12 + random() * 23;
        points.push({ u: u + 0.002, depth: bite * 0.45 });
        points.push({ u: u + 0.005, depth: bite });
        points.push({ u: u + 0.009, depth: bite * 0.7 });
        points.push({ u: u + 0.018, depth: depth + 3 });
        u += 0.018;
      }
      u += 0.003 + random() * 0.009;
    }
    points.push({ u: 1, depth: 29 });
    return points;
  });
}

// Different, irregular damage on each edge stays attached to the paper as
// the rolls turn. The camera approaches the sheet as its contour fills view.
function paperContour(width, height, half, wear, edges) {
  const path = new Path2D();
  const size = Math.max(0.65, Math.min(1.4, Math.min(width, height) / 550));
  for (let side = 0; side < 2; side++) {
    const points = edges[side];
    const exposed = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const x0 = (a.u - 0.5) * width;
      const x1 = (b.u - 0.5) * width;
      if (x1 < -half || x0 > half) continue;
      for (const x of [Math.max(-half, x0), Math.min(half, x1)]) {
        const depth = a.depth + ((x - x0) / (x1 - x0)) * (b.depth - a.depth);
        const inset = depth * size * wear;
        exposed.push([x, side ? height / 2 - inset : -height / 2 + inset]);
      }
    }
    if (side) exposed.reverse();
    for (let i = 0; i < exposed.length; i++) {
      const [x, y] = exposed[i];
      if (!side && !i) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
  }
  path.closePath();
  return path;
}

function drawRoll(c, chart, paper, edge, side, radius, width, height, unroll) {
  const top = -height / 2;
  const bottom = height / 2;
  const axis = edge + side * radius * 0.28;
  c.save();
  // Soft cast shadow leads the moving roll, with a darker contact shadow.
  const shadow = c.createLinearGradient(
    axis - radius * 3,
    0,
    axis + radius * 3,
    0,
  );
  shadow.addColorStop(0, "rgba(20,10,3,0)");
  shadow.addColorStop(0.4, "rgba(20,10,3,.2)");
  shadow.addColorStop(0.56, "rgba(20,10,3,.62)");
  shadow.addColorStop(1, "rgba(20,10,3,0)");
  c.fillStyle = shadow;
  c.fillRect(
    axis - radius * 3,
    top + radius * 0.3,
    radius * 6,
    height + radius,
  );

  c.beginPath();
  c.moveTo(axis - radius, top + 3);
  for (let i = 0; i <= 16; i++) {
    const x = axis - radius + (i / 16) * radius * 2;
    c.lineTo(x, top + Math.abs(Math.sin(i * 8.71 + side)) * 5);
  }
  c.bezierCurveTo(
    axis + radius * 1.08,
    -height * 0.22,
    axis + radius * 0.94,
    height * 0.2,
    axis + radius,
    bottom - 3,
  );
  for (let i = 16; i >= 0; i--) {
    const x = axis - radius + (i / 16) * radius * 2;
    c.lineTo(x, bottom - Math.abs(Math.sin(i * 9.19 + side)) * 6);
  }
  c.bezierCurveTo(
    axis - radius * 1.06,
    height * 0.22,
    axis - radius * 0.96,
    -height * 0.2,
    axis - radius,
    top + 3,
  );
  c.closePath();
  c.fillStyle = "#cbb186";
  c.fill();
  c.save();
  c.clip();
  // Project the printed side around a cylinder in narrow strips. The angle
  // determines both texture compression and illumination across the curl.
  const strips = 48;
  for (let i = 0; i < strips; i++) {
    const a0 = -Math.PI / 2 + (i / strips) * Math.PI;
    const a1 = -Math.PI / 2 + ((i + 1) / strips) * Math.PI;
    const x0 = axis + Math.sin(a0) * radius;
    const x1 = axis + Math.sin(a1) * radius;
    const angle = (a0 + a1) / 2;
    const sourceX =
      width / 2 + edge + side * (angle * side + Math.PI / 2) * radius;
    const sx = Math.max(
      0,
      Math.min(chart.width - 1, (sourceX / width) * chart.width),
    );
    const sw = Math.min(
      chart.width - sx,
      Math.max(1, (((a1 - a0) * radius) / width) * chart.width),
    );
    c.globalAlpha = Math.max(0, -side * Math.sin(angle)) * 0.78;
    c.drawImage(chart, sx, 0, sw, chart.height, x0, top, x1 - x0 + 0.5, height);
  }
  c.globalAlpha = 1;
  const shading = c.createLinearGradient(axis - radius, 0, axis + radius, 0);
  shading.addColorStop(0, "rgba(47,25,9,.72)");
  shading.addColorStop(0.22, "rgba(102,66,25,.12)");
  shading.addColorStop(0.4, "rgba(255,240,190,.22)");
  shading.addColorStop(0.58, "rgba(255,239,189,.12)");
  shading.addColorStop(0.78, "rgba(98,59,22,.2)");
  shading.addColorStop(1, "rgba(39,20,7,.78)");
  c.fillStyle = shading;
  c.fillRect(axis - radius, top, radius * 2, height);
  c.globalCompositeOperation = "multiply";
  c.globalAlpha = 0.9;
  c.drawImage(paper, axis - radius, top, radius * 2, height);
  c.globalCompositeOperation = "source-over";
  c.globalAlpha = 1;
  // Irregular long paper fibres stay attached to the turning surface.
  for (let i = 0; i < 15; i++) {
    const x = axis + Math.sin(i * 12.9 + unroll * side * 5) * radius;
    c.strokeStyle = i % 2 ? "rgba(255,242,204,.12)" : "rgba(67,39,15,.1)";
    c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(x, top);
    c.bezierCurveTo(
      x + 1.5,
      -height * 0.2,
      x - 1,
      height * 0.2,
      x + 0.5,
      bottom,
    );
    c.stroke();
  }
  c.restore();

  // End-on spirals give the parchment thickness instead of a flat wipe edge.
  for (const y of [top, bottom]) {
    c.fillStyle = y === top ? "#b99a63" : "#795633";
    c.strokeStyle = "#5e3e22";
    c.lineWidth = 0.7;
    c.beginPath();
    for (let step = 0; step <= 64; step++) {
      const angle = (step / 64) * Math.PI * 2;
      const r = radius * (1 - Math.abs(Math.sin(angle * 13 + side)) * 0.06);
      const x = axis + Math.cos(angle) * r;
      const sy = y + Math.sin(angle) * r * 0.19;
      if (!step) c.moveTo(x, sy);
      else c.lineTo(x, sy);
    }
    c.closePath();
    c.fill();
    c.stroke();
    c.beginPath();
    for (let step = 0; step <= 150; step++) {
      const angle = (step / 150) * Math.PI * 7 + unroll * side * 6;
      const r = radius * (0.88 - (step / 150) * 0.8);
      const x = axis + Math.cos(angle) * r;
      const sy = y + Math.sin(angle) * r * 0.19;
      if (step === 0) c.moveTo(x, sy);
      else c.lineTo(x, sy);
    }
    c.strokeStyle = "rgba(76,47,23,.65)";
    c.stroke();
  }
  c.restore();
}

function drawChart(c, chart, paper, width, height, frame, edges) {
  const closedHalf = Math.max(width * 0.025, Math.min(width, height) * 0.051);
  const half = closedHalf + (width / 2 - closedHalf) * frame.unroll;
  const radius = Math.max(0.01, Math.min(width, height) * frame.curl);
  const top = -height / 2;
  const contour = paperContour(width, height, half, 1 - frame.handoff, edges);
  c.save();
  c.translate(width / 2, height / 2 - frame.lift);
  c.rotate(frame.rotation);
  c.scale(frame.scale, frame.scale * (1 - frame.tilt));
  c.transform(1, 0, frame.tilt * 0.24, 1, 0, 0);

  // Multiple shadow lobes suggest a sheet lifting before it settles flat.
  c.save();
  c.shadowColor = `rgba(8,4,2,${0.58 * (1 - frame.handoff)})`;
  c.shadowBlur = 30 + frame.lift;
  c.shadowOffsetX = 7 * (1 - frame.handoff);
  c.shadowOffsetY = 22 * (1 - frame.handoff) + frame.lift;
  c.fillStyle = "#927147";
  c.fill(contour);
  c.restore();

  c.save();
  c.clip(contour);
  c.drawImage(chart, -width / 2, top, width, height);

  c.globalAlpha = (1 - frame.handoff) * 0.9;
  c.globalCompositeOperation = "multiply";
  c.drawImage(paper, -width / 2, top, width, height);
  c.globalCompositeOperation = "source-over";
  c.globalAlpha = 1 - frame.handoff;
  c.strokeStyle = "rgba(87,53,23,.65)";
  c.lineWidth = 4;
  c.stroke(contour);
  c.strokeStyle = "rgba(239,215,165,.7)";
  c.lineWidth = 1;
  c.stroke(contour);
  const edgeShade = c.createLinearGradient(-half, 0, half, 0);
  edgeShade.addColorStop(0, "rgba(68,38,11,.4)");
  edgeShade.addColorStop(
    Math.min(0.45, (radius * 2) / (half * 2)),
    "rgba(68,38,11,0)",
  );
  edgeShade.addColorStop(
    Math.max(0.55, 1 - (radius * 2) / (half * 2)),
    "rgba(68,38,11,0)",
  );
  edgeShade.addColorStop(1, "rgba(68,38,11,.4)");
  c.fillStyle = edgeShade;
  c.fillRect(-half, top, half * 2, height);
  c.restore();

  if (frame.curl > 0.0001) {
    drawRoll(c, chart, paper, -half, -1, radius, width, height, frame.unroll);
    drawRoll(c, chart, paper, half, 1, radius, width, height, frame.unroll);
  }
  c.restore();
}

export function createMapOpening({
  source,
  overlay,
  scene,
  skip,
  hud,
  reducedMotion,
  onComplete,
}) {
  const c = scene.getContext("2d");
  let table = null;
  let paper = null;
  const edges = createTatteredEdges();
  const chart = makeCanvas(source.width, source.height);
  const chartContext = chart.getContext("2d");
  let startedAt = null;
  let active = true;
  let width;
  let height;
  let dpr;
  const previousFocus = document.activeElement;
  overlay.setAttribute("aria-busy", "true");

  function resize() {
    width = innerWidth;
    height = innerHeight;
    dpr = Math.min(2, devicePixelRatio || 1);
    scene.width = Math.floor(width * dpr);
    scene.height = Math.floor(height * dpr);
    chart.width = source.width;
    chart.height = source.height;
    chartContext.drawImage(source, 0, 0);
  }

  function finish() {
    if (!active) return;
    active = false;
    overlay.hidden = true;
    overlay.setAttribute("aria-busy", "false");
    hud.inert = false;
    document.body.classList.remove("map-opening");
    skip.removeEventListener("click", finish);
    document.removeEventListener("keydown", handleKey, true);
    reducedMotion.removeEventListener("change", handleMotion);
    if (document.activeElement === skip) {
      skip.blur();
      previousFocus?.focus({ preventScroll: true });
    }
    // Release large transient textures once the chart fills the viewport.
    chart.width = chart.height = scene.width = scene.height = 0;
    if (table) table.width = table.height = 0;
    if (paper) paper.width = paper.height = 0;
    onComplete();
  }

  function handleKey(event) {
    if (event.key === "Tab") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (["Escape", "Enter", " "].includes(event.key)) finish();
  }

  function handleMotion() {
    if (reducedMotion.matches) finish();
  }

  function render(now) {
    if (!active || !table || !paper) return;
    if (startedAt === null) startedAt = now;
    const frame = mapOpeningFrame(now - startedAt, reducedMotion.matches);
    if (frame.complete) {
      finish();
      return;
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Cover the viewport without stretching the wood grain on tall screens.
    const scale = Math.max(width / table.width, height / table.height);
    const tw = table.width * scale;
    const th = table.height * scale;
    c.drawImage(table, (width - tw) / 2, (height - th) / 2, tw, th);
    drawChart(c, chart, paper, width, height, frame, edges);
    skip.style.opacity = 1 - frame.handoff * 0.8;
  }

  resize();
  hud.inert = true;
  skip.addEventListener("click", finish);
  document.addEventListener("keydown", handleKey, true);
  reducedMotion.addEventListener("change", handleMotion);
  if (reducedMotion.matches) finish();
  else {
    skip.focus({ preventScroll: true });
    Promise.all([
      loadTexture(TEXTURE_URLS.table),
      loadTexture(TEXTURE_URLS.paper),
    ]).then(([tableTexture, paperTexture]) => {
      if (!active) return;
      table = createTable(tableTexture);
      paper = createPaperTexture(paperTexture);
      overlay.setAttribute("aria-busy", "false");
      render(performance.now());
    });
  }
  return {
    get active() {
      return active;
    },
    render,
    resize,
    finish,
  };
}
