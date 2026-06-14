import assert from "node:assert/strict";
import test from "node:test";

import {
  contractCargoCount,
  contractOffersForPort,
  createContractOffer,
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
      estimatedDays: 2,
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
      name: "Goldhaven",
      x: 0,
      y: 0,
      factions: [{ name: "Crown" }],
    },
    destinations: ["Far"],
  }).offer;
  assert.equal(guild.faction, "Guild of Gilded Oars");
  assert.equal(guild.influence, 8);
  assert.equal(guild.estimatedDays, 3);
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
