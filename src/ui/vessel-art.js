// One painted vessel plate is shared by the catalog and dock inspection.
const VESSEL_ART = {
  cutter: "./assets/vessels/cutter.png",
  sloop: "./assets/vessels/sloop.png",
  carrack: "./assets/vessels/carrack.png",
  barque: "./assets/vessels/barque.png",
  brig: "./assets/vessels/brig.png",
  dhow: "./assets/vessels/dhow.png",
};

export function vesselArtworkUrl(id = "cutter") {
  return VESSEL_ART[id] || VESSEL_ART.cutter;
}

export function vesselIllustration(id = "cutter") {
  return `<img class="vessel-art" src="${vesselArtworkUrl(id)}" width="1536" height="1024" alt="" aria-hidden="true" decoding="sync" draggable="false">`;
}

// Editorial coordinates refer to each painting, rather than the sailing model.
const PLATE_POINTS = {
  cutter: { rigging: [650, 400], fittings: [735, 750], weapons: [1085, 780] },
  sloop: { rigging: [680, 395], fittings: [635, 795], weapons: [1085, 830] },
  carrack: { rigging: [745, 370], fittings: [750, 775], weapons: [1010, 845] },
  barque: { rigging: [705, 360], fittings: [785, 800], weapons: [1070, 840] },
  brig: { rigging: [685, 380], fittings: [710, 765], weapons: [1010, 860] },
  dhow: { rigging: [585, 400], fittings: [870, 785], weapons: [1100, 830] },
};

export function vesselInspectionArtwork(id = "cutter") {
  const points = PLATE_POINTS[id] || PLATE_POINTS.cutter;
  const parts = [
    { key: "hull", point: [690, 930], area: "M140 850H1250L1140 995H140Z" },
    { key: "rigging", point: points.rigging, area: "M190 40H1240V680H190Z" },
    { key: "rudder", point: [95, 925], area: "M25 820H145V1000H25Z" },
    { key: "fittings", point: points.fittings, area: "M440 710H940V825H440Z" },
    { key: "weapons", point: points.weapons, area: "M965 770H1180V885H965Z" },
  ];
  const targets = parts
    .map(
      ({ key, point: [x, y], area }, i) =>
        `<g class="ship-section" data-part="${key}"><path class="inspection-hit" d="${area}"/><g class="inspection-pin" transform="translate(${x} ${y})"><circle class="inspection-pin-halo" r="60"/><circle class="inspection-pin-face" r="42"/><text text-anchor="middle" dominant-baseline="central">${i + 1}</text></g></g>`,
    )
    .join("");
  return `<div class="inspection-vessel-plate"><svg class="inspection-diagram" viewBox="0 0 1536 1024" aria-hidden="true" focusable="false"><image href="${vesselArtworkUrl(id)}" width="1536" height="1024"/>${targets}</svg><span class="inspection-plate-caption">Select a ship system to inspect</span></div>`;
}
