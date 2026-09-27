const freezeModel = (model) =>
  Object.freeze({
    ...model,
    bow: -model.length / 2,
    stern: model.length / 2,
    deckY: 0,
    masts: Object.freeze(model.masts.map(Object.freeze)),
  });

export const SHIP_MODEL_PROFILES = Object.freeze({
  cutter: freezeModel({
    length: 31,
    beam: 8,
    deckHeight: 4.2,
    sternRise: 1.6,
    bowRise: 0.9,
    rig: "gaff",
    masts: [{ y: -3, height: 30, yard: 14, sails: 2 }],
    cabin: "small",
    cargo: 2,
    pennantY: -10,
  }),
  sloop: freezeModel({
    length: 30,
    beam: 6.4,
    deckHeight: 3.3,
    sternRise: 1.1,
    bowRise: 0.5,
    rig: "lateen",
    masts: [{ y: -4, height: 32, yard: 19, sails: 1 }],
    cabin: "tiny",
    cargo: 0,
    pennantY: -9,
  }),
  carrack: freezeModel({
    length: 39,
    beam: 13,
    deckHeight: 5.8,
    sternRise: 5,
    bowRise: 2.3,
    rig: "square",
    masts: [
      { y: -11, height: 30, yard: 14, sails: 2 },
      { y: -1, height: 37, yard: 17, sails: 3 },
      { y: 9, height: 28, yard: 12, sails: 2 },
    ],
    cabin: "high",
    cargo: 4,
    pennantY: -13,
  }),
  barque: freezeModel({
    length: 42,
    beam: 9.3,
    deckHeight: 4.6,
    sternRise: 2.7,
    bowRise: 1.5,
    rig: "barque",
    masts: [
      { y: -13, height: 31, yard: 13, sails: 2 },
      { y: -3, height: 37, yard: 16, sails: 3 },
      { y: 8, height: 30, yard: 13, sails: 2 },
    ],
    cabin: "survey",
    cargo: 1,
    pennantY: -12,
  }),
  brig: freezeModel({
    length: 36,
    beam: 10.4,
    deckHeight: 4.8,
    sternRise: 2.4,
    bowRise: 1.5,
    rig: "square",
    masts: [
      { y: -8, height: 33, yard: 15, sails: 3 },
      { y: 6, height: 30, yard: 14, sails: 2 },
    ],
    cabin: "small",
    cargo: 2,
    guns: true,
    pennantY: -11,
  }),
  dhow: freezeModel({
    length: 33,
    beam: 8.7,
    deckHeight: 3.8,
    sternRise: 1.6,
    bowRise: 1.9,
    rig: "lateen",
    masts: [{ y: -1, height: 34, yard: 22, sails: 1 }],
    cabin: "tiny",
    cargo: 1,
    outrigger: true,
    pennantY: -10,
  }),
});

export const SHIP_MODEL_IDS = Object.freeze(Object.keys(SHIP_MODEL_PROFILES));

export function getShipModelProfile(vesselClass, fallbackSeed = 0) {
  if (SHIP_MODEL_PROFILES[vesselClass]) return SHIP_MODEL_PROFILES[vesselClass];
  const safeSeed = Number.isFinite(Number(fallbackSeed))
    ? Number(fallbackSeed)
    : 0;
  const index = Math.abs(Math.floor(safeSeed)) % SHIP_MODEL_IDS.length;
  return SHIP_MODEL_PROFILES[SHIP_MODEL_IDS[index]];
}
