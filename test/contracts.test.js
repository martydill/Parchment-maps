import { PORT_NAMES, FACTION_NAMES } from "../src/names.js";
import assert from "node:assert/strict";
import test from "node:test";

import {
  contractCargoCount,
  contractOffersForPort,
  createContractOffer,
  createSurveyContractOffer,
  surveyContractProgress,
  surveyContractThemeCount,
} from "../src/core/contracts.js";

const ports = {
  Near: { name: "Near", x: 100, y: 0 },
  Far: { name: "Far", x: 1000, y: 0 },
};

function offer(overrides = {}) {
  return createContractOffer({
    origin: {
      name: "Harbor",
      x: 0,
      y: 0,
      factions: [{ name: "First" }, { name: "Second" }],
    },
    index: 0,
    day: 2,
    serial: 7,
    destinations: ["Near", "Far"],
    cargoNames: ["tea", "silk"],
    getPort: (name) => ports[name],
    distanceBetween: (destination, origin) =>
      Math.hypot(destination.x - origin.x, destination.y - origin.y),
    ...overrides,
  });
}

test("createContractOffer builds cargo commissions and advances the serial", () => {
  assert.deepEqual(offer(), {
    offer: {
      id: "C7",
      origin: "Harbor",
      destination: "Near",
      title: "Cargo commission to Near",
      cargoName: "tea",
      cargoUnits: 4,
      reward: 88,
      influence: 5,
      faction: "First",
      estimatedDays: 1,
      acceptedDay: null,
      deadline: null,
    },
    nextSerial: 8,
  });
});

test("createContractOffer builds courier work and selects local or guild sponsors", () => {
  const courier = offer({ index: 1, day: 0 }).offer;
  assert.equal(courier.title, "Urgent dispatch to Far");
  assert.equal(courier.cargoName, "sealed diplomatic pouch");
  assert.equal(courier.cargoUnits, 1);
  assert.equal(courier.reward, 144);
  assert.equal(courier.faction, "Second");

  const guild = offer({
    origin: {
      name: PORT_NAMES.orvessaQuay,
      x: 0,
      y: 0,
      factions: [{ name: "Crown" }],
    },
    destinations: ["Far"],
  }).offer;
  assert.equal(guild.faction, FACTION_NAMES.syrrelwakeOarwrightPact);
  assert.equal(guild.influence, 8);
  assert.equal(guild.estimatedDays, 1);
});

test("contractOffersForPort reuses fresh caches and refreshes expired ones", () => {
  const cache = { refreshedDay: 5, offers: [{ id: "old" }] };
  assert.equal(
    contractOffersForPort({ cache, day: 8, createOffer: () => null }),
    cache,
  );

  assert.deepEqual(
    contractOffersForPort({
      cache,
      day: 9,
      offerCount: 2,
      refreshDays: 4,
      createOffer: (index) => ({ id: index }),
    }),
    { refreshedDay: 9, offers: [{ id: 0 }, { id: 1 }] },
  );
  assert.deepEqual(
    contractOffersForPort({
      cache: null,
      day: 1,
      offerCount: 0,
      createOffer: () => null,
    }),
    { refreshedDay: 1, offers: [] },
  );
});

test("contractCargoCount sums cargo across active contracts", () => {
  assert.equal(contractCargoCount([]), 0);
  assert.equal(contractCargoCount([{ cargoUnits: 2 }, { cargoUnits: 3 }]), 5);
});

test("createContractOffer supports custom voyage estimates and single-faction ports", () => {
  const custom = offer({
    index: 1,
    day: 0,
    origin: {
      name: "Harbor",
      x: 0,
      y: 0,
      factions: [{ name: "Only Guild" }],
    },
    estimateDays: (distance, { origin, destination }) => {
      assert.equal(distance, 1000);
      assert.equal(origin.name, "Harbor");
      assert.equal(destination.name, "Far");
      return 9;
    },
  }).offer;

  assert.equal(custom.faction, "Only Guild");
  assert.equal(custom.estimatedDays, 9);
});

test("contract offer caches use default refresh and offer counts", () => {
  assert.deepEqual(
    contractOffersForPort({
      day: 12,
      createOffer: (index) => ({ id: `new-${index}` }),
    }),
    {
      refreshedDay: 12,
      offers: [{ id: "new-0" }, { id: "new-1" }, { id: "new-2" }],
    },
  );
});

test("survey contract catalogue has broad commission variety", () => {
  assert.ok(surveyContractThemeCount() >= 18);

  const titles = new Set(
    Array.from(
      { length: surveyContractThemeCount() },
      (_, day) =>
        createSurveyContractOffer({
          origin: { name: "Harbor", factions: [] },
          index: 2,
          day: day + 10,
          serial: 100 + day,
        }).offer.title,
    ),
  );
  assert.equal(titles.size, surveyContractThemeCount());
});

test("createSurveyContractOffer builds zero-hold exploration commissions", () => {
  const result = createSurveyContractOffer({
    origin: {
      name: PORT_NAMES.orvessaQuay,
      factions: [{ name: "Royal Navy" }, { name: "Free Keel Brotherhood" }],
    },
    index: 0,
    day: 1,
    serial: 12,
  });

  assert.equal(result.nextSerial, 13);
  assert.equal(result.offer.id, "S12");
  assert.equal(result.offer.kind, "survey");
  assert.equal(result.offer.cargoUnits, 0);
  assert.equal(result.offer.destination, null);
  assert.ok(result.offer.survey.required >= 1);
  assert.deepEqual(result.offer.survey.completed, []);
});

test("surveyContractProgress completes matching discovery commissions once", () => {
  const contract = createSurveyContractOffer({
    origin: { name: "Harbor", factions: [] },
    index: 2,
    day: 13,
    serial: 20,
  }).offer;
  assert.equal(contract.survey.key, "free-keel-secret");

  const site = { id: "starfall", faction: "Free Keel Brotherhood" };
  assert.equal(
    surveyContractProgress(contract, {
      type: "discovery",
      site,
      disposition: "sell",
    }),
    null,
  );
  assert.deepEqual(
    surveyContractProgress(contract, {
      type: "discovery",
      site,
      disposition: "secret",
    }),
    { complete: true, completed: 1, required: 1 },
  );
  assert.equal(
    surveyContractProgress(contract, {
      type: "discovery",
      site,
      disposition: "secret",
    }),
    null,
  );
});

test("surveyContractProgress tracks multi-site exploration commissions", () => {
  const contract = createSurveyContractOffer({
    origin: { name: "Harbor", factions: [{ name: "Navy" }] },
    index: 2,
    day: 10,
    serial: 30,
  }).offer;
  assert.equal(contract.survey.key, "northern-chain");

  assert.equal(
    surveyContractProgress(contract, {
      type: "exploration",
      site: { id: "south", y: 900 },
    }),
    null,
  );
  assert.deepEqual(
    surveyContractProgress(contract, {
      type: "exploration",
      site: { id: "north-1", y: 700 },
    }),
    { complete: false, completed: 1, required: 3 },
  );
  assert.deepEqual(
    surveyContractProgress(contract, {
      type: "exploration",
      site: { id: "north-2", y: 650 },
    }),
    { complete: false, completed: 2, required: 3 },
  );
  assert.deepEqual(
    surveyContractProgress(contract, {
      type: "exploration",
      site: { id: "north-3", y: 500 },
    }),
    { complete: true, completed: 3, required: 3 },
  );
});

test("surveyContractProgress matches named passage, reef, and mineral objectives", () => {
  const glasswater = createSurveyContractOffer({
    origin: { name: "Harbor", factions: [] },
    index: 2,
    day: 11,
    serial: 40,
  }).offer;
  assert.equal(glasswater.survey.key, "glasswater-passage");
  assert.equal(glasswater.faction, "Chartmakers’ Hall");
  assert.deepEqual(
    surveyContractProgress(glasswater, {
      type: "discovery",
      disposition: "share",
      site: {
        id: "glass",
        route: {
          origin: PORT_NAMES.velquorin,
          destination: PORT_NAMES.mirravel,
        },
      },
    }),
    { complete: true, completed: 1, required: 1 },
  );

  const reef = createSurveyContractOffer({
    origin: { name: "Harbor", factions: [] },
    index: 2,
    day: 12,
    serial: 41,
  }).offer;
  assert.equal(reef.survey.key, "navy-reefs");
  assert.deepEqual(
    surveyContractProgress(reef, {
      type: "exploration",
      site: { id: "reef-1", hazards: "Hidden reefs, sudden squalls" },
    }),
    { complete: false, completed: 1, required: 2 },
  );

  const minerals = createSurveyContractOffer({
    origin: { name: "Harbor", factions: [] },
    index: 2,
    day: 14,
    serial: 42,
  }).offer;
  assert.equal(minerals.survey.key, "deep-delvers-minerals");
  assert.deepEqual(
    surveyContractProgress(minerals, {
      type: "discovery",
      disposition: "share",
      site: { id: "ore", route: { good: "ore" } },
    }),
    { complete: true, completed: 1, required: 1 },
  );
});

test("surveyContractProgress ignores malformed contracts and unknown themes", () => {
  assert.equal(surveyContractProgress(null, { site: { id: "x" } }), null);
  assert.equal(
    surveyContractProgress({ kind: "cargo" }, { site: { id: "x" } }),
    null,
  );
  assert.equal(
    surveyContractProgress({ kind: "survey", survey: {} }, null),
    null,
  );
  assert.equal(
    surveyContractProgress(
      {
        kind: "survey",
        survey: { key: "missing", target: "exploration", completed: [] },
      },
      { type: "exploration", site: { id: "x" } },
    ),
    null,
  );
});

test("survey objective matchers cover fallback route and description branches", () => {
  const glassByOrigin = createSurveyContractOffer({
    origin: { name: "Harbor", factions: [] },
    index: 2,
    day: 11,
    serial: 50,
  }).offer;
  assert.deepEqual(
    surveyContractProgress(glassByOrigin, {
      type: "discovery",
      disposition: "share",
      site: {
        id: "glass-origin",
        route: { origin: PORT_NAMES.mirravel, destination: "Pearlstrand" },
      },
    }),
    { complete: true, completed: 1, required: 1 },
  );

  const glassByBenefit = createSurveyContractOffer({
    origin: { name: "Harbor", factions: [] },
    index: 2,
    day: 11,
    serial: 51,
  }).offer;
  assert.deepEqual(
    surveyContractProgress(glassByBenefit, {
      type: "discovery",
      disposition: "share",
      site: {
        id: "glass-benefit",
        benefit: `Safer ${PORT_NAMES.mirravel} passage.`,
      },
    }),
    { complete: true, completed: 1, required: 1 },
  );

  const mineralsByFaction = createSurveyContractOffer({
    origin: { name: "Harbor", factions: [] },
    index: 2,
    day: 14,
    serial: 52,
  }).offer;
  assert.deepEqual(
    surveyContractProgress(mineralsByFaction, {
      type: "discovery",
      disposition: "share",
      site: { id: "delver", faction: "Deep Delvers’ Union" },
    }),
    { complete: true, completed: 1, required: 1 },
  );

  const mineralsByType = createSurveyContractOffer({
    origin: { name: "Harbor", factions: [] },
    index: 2,
    day: 14,
    serial: 53,
  }).offer;
  assert.deepEqual(
    surveyContractProgress(mineralsByType, {
      type: "discovery",
      disposition: "share",
      site: { id: "deposit", type: "Hidden resource deposit" },
    }),
    { complete: true, completed: 1, required: 1 },
  );
});

test("survey contracts cover sponsor and nonmatching progress branches", () => {
  const freeKeel = createSurveyContractOffer({
    origin: { name: "Harbor" },
    index: 2,
    day: 13,
    serial: 60,
  }).offer;
  assert.equal(freeKeel.faction, "Free Keel Brotherhood");

  const northern = createSurveyContractOffer({
    origin: { name: "Harbor", factions: [{ name: "Surveyors" }] },
    index: 2,
    day: 10,
    serial: 61,
  }).offer;
  assert.equal(
    surveyContractProgress(northern, {
      type: "discovery",
      site: { id: "wrong-type", y: 500 },
    }),
    null,
  );

  assert.equal(
    surveyContractProgress(
      {
        kind: "survey",
        survey: {
          key: "northern-chain",
          target: "exploration",
          completed: ["north"],
        },
      },
      { type: "exploration", site: { id: "north", y: 500 } },
    ),
    null,
  );
});
