import { chartedCityIndicators } from "../core/chart.js";
import { layoutMapLabels } from "../core/label-layout.js";
import { drawShip } from "../rendering.js?v=5";
import { drawExplorationSite } from "../exploration-rendering.js";

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
  const unchartedPaper = f.createLinearGradient(0, 0, 0, h);
  unchartedPaper.addColorStop(0, "rgba(166,161,125,.95)");
  unchartedPaper.addColorStop(0.55, "rgba(148,153,123,.95)");
  unchartedPaper.addColorStop(1, "rgba(129,142,119,.95)");
  f.fillStyle = unchartedPaper;
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
  drawChartPortLabels(c, ports, isWorldPointExplored, sx, sy, w, h);
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

function drawChartPortLabels(c, ports, isWorldPointExplored, sx, sy, w, h) {
  c.save();
  c.font = "700 12px Georgia";
  const labels = ports
    .filter((port) => isWorldPointExplored(port.x, port.y))
    .map((port) => ({
      id: port.name,
      x: port.x * sx,
      y: port.y * sy,
      width: Math.ceil(c.measureText(port.name).width) + 12,
      height: 21,
      priority: port.home ? 2 : 1,
    }));
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (const label of layoutMapLabels(labels, [], w, h)) {
    c.fillStyle = "rgba(239,220,175,.9)";
    c.strokeStyle = "rgba(88,61,34,.7)";
    c.lineWidth = 1;
    c.beginPath();
    c.roundRect(label.x, label.y, label.width, label.height, 4);
    c.fill();
    c.stroke();
    c.fillStyle = "#302318";
    c.fillText(label.id, label.x + label.width / 2, label.y + label.height / 2);
  }
  c.restore();
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
    drawExplorationSite(
      c,
      site,
      site.x * sx,
      site.y * sy,
      25,
      progress?.status === "surveyed",
    );
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
