import { chartedCityIndicators } from "../core/chart.js";
import { drawShip } from "../rendering.js?v=2";

export function renderChartPanel({
  activeRumorLeads,
  buildVisibilityPolygon,
  chartedCities,
  courseBearing,
  currentObjective,
  currentPort,
  drawShipOptions,
  eventTemplates,
  exploredMask,
  explorationSites,
  game,
  getPortByName,
  homePortName,
  isWorldPointExplored,
  mapLayer,
  merchantShips,
  merchantVisible,
  minimap,
  minimapCtx,
  minimapFog,
  minimapFogCtx,
  minimapWrap,
  nearPort,
  onOpenTown,
  ports,
  punchCurrentVisibility,
  ship,
  world,
  wrapX,
}) {
  buildVisibilityPolygon(true);
  const c = minimapCtx,
    w = minimap.width,
    h = minimap.height,
    sx = w / world.w,
    sy = h / world.h;
  c.globalCompositeOperation = "source-over";
  c.clearRect(0, 0, w, h);
  c.drawImage(mapLayer, 0, 0, w, h);
  const f = minimapFogCtx;
  f.clearRect(0, 0, w, h);
  f.fillStyle = "rgba(77,94,86,.96)";
  f.fillRect(0, 0, w, h);
  f.globalCompositeOperation = "destination-out";
  f.globalAlpha = 0.64;
  f.drawImage(exploredMask, 0, 0, w, h);
  f.globalAlpha = 1;
  f.save();
  f.filter = "blur(3px)";
  punchCurrentVisibility(f, sx, sy, true);
  f.restore();
  f.globalCompositeOperation = "source-over";
  c.drawImage(minimapFog, 0, 0);
  drawAmberConvoyRoute(c, sx, sy, game);
  drawActiveContracts(c, sx, sy, game, getPortByName);
  drawObjective(c, sx, sy, {
    currentObjective,
    currentPort,
    game,
    getPortByName,
    homePortName,
    nearPort,
  });
  drawRumorLeads(c, sx, sy, activeRumorLeads(), world);
  drawPlottedCourse(c, sx, sy, {
    courseBearing,
    game,
    getPortByName,
    ship,
    world,
    wrapX,
  });
  drawExplorationSites(c, sx, sy, {
    explorationSites,
    game,
    isWorldPointExplored,
  });
  drawScheduledEventMarkers(c, sx, sy, { eventTemplates, game, getPortByName });
  drawMerchantMarkers(c, sx, sy, { merchantShips, merchantVisible, wrapX });
  drawPlayerShip(c, sx, sy, { drawShipOptions, ship, wrapX });
  renderChartedCities({
    chartedCities,
    isWorldPointExplored,
    minimapWrap,
    onOpenTown,
    ports,
    world,
  });
}

function drawAmberConvoyRoute(c, sx, sy, game) {
  if (!game.laws.amberConvoy) return;
  c.strokeStyle = "rgba(190,132,45,.95)";
  c.lineWidth = 3;
  c.setLineDash([9, 6]);
  c.beginPath();
  c.moveTo(650 * sx, 485 * sy);
  c.bezierCurveTo(
    850 * sx,
    570 * sy,
    1070 * sx,
    780 * sy,
    1190 * sx,
    1050 * sy,
  );
  c.lineTo(1450 * sx, 1185 * sy);
  c.stroke();
  c.setLineDash([]);
}

function drawActiveContracts(c, sx, sy, game, getPortByName) {
  for (const contract of game.activeContracts) {
    const p = getPortByName(contract.destination);
    if (!p) continue;
    c.strokeStyle = "#d5a13d";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(p.x * sx, p.y * sy, 12, 0, Math.PI * 2);
    c.stroke();
  }
}

function drawObjective(
  c,
  sx,
  sy,
  {
    currentObjective,
    currentPort,
    game,
    getPortByName,
    homePortName,
    nearPort,
  },
) {
  const objective = currentObjective({
    game,
    currentPortName: currentPort?.name || null,
    nearPortName: nearPort?.name || null,
    homePortName,
  });
  if (!objective.destination) return;
  const p = getPortByName(objective.destination);
  if (!p) return;
  c.strokeStyle = "#75c978";
  c.lineWidth = 4;
  c.beginPath();
  c.arc(p.x * sx, p.y * sy, 19, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = "#fff0c5";
  c.font = "bold 14px Georgia";
  c.textAlign = "center";
  c.fillText(objective.title, p.x * sx, p.y * sy - 25);
}

function drawRumorLeads(c, sx, sy, leads, world) {
  for (const lead of leads) {
    c.strokeStyle = lead.falseLead
      ? "rgba(180,92,70,.75)"
      : "rgba(244,218,157,.85)";
    c.fillStyle = "rgba(244,218,157,.12)";
    c.lineWidth = 2;
    c.setLineDash([6, 6]);
    for (const offset of [-world.w, 0, world.w]) {
      c.beginPath();
      c.arc(
        (lead.x + offset) * sx,
        lead.y * sy,
        lead.radius * sx,
        0,
        Math.PI * 2,
      );
      c.fill();
      c.stroke();
    }
    c.setLineDash([]);
  }
}

function drawPlottedCourse(
  c,
  sx,
  sy,
  { courseBearing, game, getPortByName, ship, world, wrapX },
) {
  const courseDestination = getPortByName(game.navigation.destination);
  if (!courseDestination) return;
  const bearing = courseBearing(ship, courseDestination, world.w);
  c.strokeStyle = "#66c8b5";
  c.lineWidth = 3;
  c.setLineDash([9, 6]);
  for (const offset of [-world.w, 0, world.w]) {
    c.beginPath();
    c.moveTo((wrapX(ship.x) + offset) * sx, ship.y * sy);
    c.lineTo((bearing.destinationX + offset) * sx, courseDestination.y * sy);
    c.stroke();
  }
  c.setLineDash([]);
  c.beginPath();
  c.arc(courseDestination.x * sx, courseDestination.y * sy, 23, 0, Math.PI * 2);
  c.stroke();
}

function drawExplorationSites(
  c,
  sx,
  sy,
  { explorationSites, game, isWorldPointExplored },
) {
  for (const site of explorationSites) {
    const progress = game.exploration.sites[site.id];
    if (!progress && !isWorldPointExplored(site.x, site.y)) continue;
    c.strokeStyle = progress?.status === "surveyed" ? "#7bcda0" : "#f4da9d";
    c.fillStyle = progress ? "rgba(52,72,46,.88)" : "rgba(62,45,25,.82)";
    c.lineWidth = 2;
    c.setLineDash(progress?.status === "surveyed" ? [] : [4, 3]);
    c.beginPath();
    c.arc(site.x * sx, site.y * sy, 7, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.setLineDash([]);
  }
}

function drawScheduledEventMarkers(
  c,
  sx,
  sy,
  { eventTemplates, game, getPortByName },
) {
  for (const event of game.scheduledEvents) {
    if (!event.known || event.started) continue;
    const t = eventTemplates[event.templateId],
      p = getPortByName(t.port);
    c.strokeStyle = "#8b4e2d";
    c.lineWidth = 3;
    c.setLineDash([5, 4]);
    c.beginPath();
    c.arc(p.x * sx, p.y * sy, 15, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
  }
}

function drawMerchantMarkers(
  c,
  sx,
  sy,
  { merchantShips, merchantVisible, wrapX },
) {
  for (const merchant of merchantShips) {
    if (!merchantVisible(merchant)) continue;
    c.fillStyle = merchant.color;
    c.strokeStyle = "#f1ddb0";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(wrapX(merchant.x) * sx, (merchant.y - 8) * sy);
    c.lineTo((wrapX(merchant.x) + 6) * sx, (merchant.y + 6) * sy);
    c.lineTo((wrapX(merchant.x) - 6) * sx, (merchant.y + 6) * sy);
    c.closePath();
    c.fill();
    c.stroke();
  }
}

function drawPlayerShip(c, sx, sy, { drawShipOptions, ship, wrapX }) {
  c.save();
  c.translate(wrapX(ship.x) * sx, ship.y * sy);
  c.scale(0.5, 0.5);
  drawShip(
    c,
    0,
    0,
    drawShipOptions.angle,
    drawShipOptions.windAngle,
    drawShipOptions.windStrength,
    drawShipOptions.classId,
  );
  c.restore();
}

function renderChartedCities({
  chartedCities,
  isWorldPointExplored,
  minimapWrap,
  onOpenTown,
  ports,
  world,
}) {
  chartedCities.replaceChildren();
  const indicators = chartedCityIndicators(
    ports,
    (port) => isWorldPointExplored(port.x, port.y),
    world,
  );
  for (const indicator of indicators) {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "charted-city";
    marker.style.left = indicator.left;
    marker.style.top = indicator.top;
    marker.dataset.cityName = indicator.city.name;
    marker.setAttribute("aria-label", `Open ${indicator.city.name}`);
    marker.addEventListener("click", () => {
      minimapWrap.style.display = "none";
      onOpenTown(indicator.city, true);
    });
    chartedCities.append(marker);
  }
}
