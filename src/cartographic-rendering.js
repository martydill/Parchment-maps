import {
  createWrappedPolygonLookup,
  polygonCentroid,
} from "./core/geometry.js";
import {
  labelZoomOpacity,
  layoutPathGlyphs,
  letteringPoint,
  regionalLettering,
} from "./core/cartography.js";

// Geography is planned once. Only opacity changes with zoom; panning never
// causes lettering to jump between placements or reshuffle its tracking.
export function createCartographicRendering({ lands, seas, worldWidth }) {
  const onLand = createWrappedPolygonLookup(
    lands.map((land) => land.poly),
    worldWidth,
  );
  const labels = lands
    .filter((land) => land.name)
    .map((land) => ({
      text: land.name.toUpperCase(),
      tier: "region",
      size: 22,
      path: regionalLettering(land.poly, polygonCentroid(land.poly)),
    }));
  seas.forEach(([text, x, y, size], index) => {
    const span = Math.min(820, text.length * size * 0.76);
    let best;
    let bestScore = Infinity;
    // Test the whole ribbon, including letter height, against the coasts.
    // Small shifts let a name follow its basin rather than cross an island.
    for (const dy of [0, -80, 80, -160, 160]) {
      for (const angle of [0, -0.16, 0.16]) {
        for (const bend of [-42, 42]) {
          const path = { x, y: y + dy, span, angle, bend };
          let score =
            Math.abs(dy) * 0.01 + Math.abs(angle) + (bend > 0 ? 0.05 : 0);
          for (let sample = 0; sample <= 16; sample++) {
            const point = letteringPoint(path, sample / 16);
            for (const edge of [-size / 2, size / 2])
              if (onLand(point.x, point.y + edge)) score += 10;
          }
          if (score < bestScore) {
            best = path;
            bestScore = score;
          }
        }
      }
    }
    labels.push({
      text,
      tier: "sea",
      size: size * 0.76,
      path: best,
      warm: index % 3 === 2,
    });
  });
  let prepared = false;
  function prepare(c) {
    for (const label of labels) {
      label.font = `italic ${label.size}px Georgia`;
      c.font = label.font;
      const widths = [...label.text].map((glyph) => c.measureText(glyph).width);
      // Long regional names shrink to fit small islands before tracking out.
      const ink = widths.reduce((sum, width) => sum + width, 0);
      const scale = Math.min(1, (label.path.span * 0.84) / Math.max(1, ink));
      label.font = `italic ${label.size * scale}px Georgia`;
      label.glyphs = layoutPathGlyphs(
        widths.map((width) => width * scale),
        label.path,
      );
    }
    prepared = true;
  }
  return {
    invalidate() {
      prepared = false;
    },
    draw(c, { zoom = 1, overview = false, copies = [0], bounds } = {}) {
      c.save();
      if (!prepared) prepare(c);
      const inheritedAlpha = c.globalAlpha;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.lineJoin = "round";
      c.lineWidth = 2.5;
      c.strokeStyle = "rgba(236,220,181,.65)";
      for (const label of labels) {
        c.globalAlpha =
          inheritedAlpha *
          (overview ? 1 : labelZoomOpacity(zoom, label.tier)) *
          (label.tier === "sea" ? 0.66 : 0.74);
        if (c.globalAlpha < 0.01) continue;
        c.font = label.font;
        c.fillStyle =
          label.tier === "region"
            ? "#493b28"
            : label.warm
              ? "#6b553a"
              : "#3c514b";
        for (const offset of copies) {
          const radius =
            label.path.span / 2 + Math.abs(label.path.bend) + label.size;
          if (
            bounds &&
            (label.path.x + offset + radius < bounds.left ||
              label.path.x + offset - radius > bounds.right ||
              label.path.y + radius < bounds.top ||
              label.path.y - radius > bounds.bottom)
          )
            continue;
          label.glyphs.forEach((glyph, index) => {
            c.save();
            c.translate(glyph.x + offset, glyph.y);
            c.rotate(glyph.angle);
            c.strokeText(label.text[index], 0, 0);
            c.fillText(label.text[index], 0, 0);
            c.restore();
          });
        }
      }
      c.restore();
    },
  };
}
