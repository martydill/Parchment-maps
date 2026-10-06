import { MAP_TILT_COS } from "./core/projection.js";
import {
  drawDiscoverySite,
  drawExplorationSite,
} from "./exploration-rendering.js";

// Survey art and its shadows are static. Bake at the display's actual transform
// so Chrome never filters shadows on the large game canvas every frame.
export function createSiteMarkerRendering() {
  const markers = new Map();
  return {
    draw(
      c,
      site,
      {
        kind = "exploration",
        size = 48,
        surveyed = false,
        active = false,
        secret = false,
        pixelRatio = 1,
      } = {},
    ) {
      const id = `${kind}:${site.id}`;
      const key = [
        size,
        surveyed,
        active,
        secret,
        pixelRatio,
        c.globalAlpha,
        site.name,
        site.type,
      ].join(":");
      let marker = markers.get(id);
      if (!marker || marker.key !== key || marker.site !== site) {
        const canvas = marker?.canvas ?? document.createElement("canvas");
        const extent = size * 2 + 64;
        canvas.width = Math.ceil(extent * pixelRatio);
        canvas.height = Math.ceil(extent * pixelRatio * MAP_TILT_COS);
        const art = canvas.getContext("2d");
        art.globalAlpha = c.globalAlpha;
        art.setTransform(
          pixelRatio,
          0,
          0,
          pixelRatio * MAP_TILT_COS,
          canvas.width / 2,
          canvas.height / 2,
        );
        if (kind === "discovery")
          drawDiscoverySite(art, site, 0, 0, size, active, secret);
        else drawExplorationSite(art, site, 0, 0, size, surveyed, active);
        marker = { key, canvas, site };
        markers.set(id, marker);
      }
      const { canvas } = marker;
      const width = canvas.width / pixelRatio;
      const height = canvas.height / (pixelRatio * MAP_TILT_COS);
      c.save();
      c.globalAlpha = 1;
      c.drawImage(canvas, -width / 2, -height / 2, width, height);
      c.restore();
    },
  };
}
