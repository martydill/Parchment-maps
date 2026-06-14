import assert from "node:assert/strict";
import test from "node:test";

import {
  applyStandingChange,
  chooseFactionCharter,
  contractConflict,
  factionLore,
  factionRivals,
  factionsAreRivals,
} from "../src/core/factions.js";

test("faction lore gives major and local factions a complete profile", () => {
  const delvers = factionLore({ name: "Deep Delvers’ Union" });
  assert.match(delvers.backstory, /secret compact/);
  assert.match(delvers.history, /Nine-Day Cave-In/);
  assert.match(delvers.motivations, /safety rules/);

  const local = factionLore(
    { name: "Harbor Council", note: "Controls the customs vote" },
    {
      name: "Farport",
      realm: "the Western League",
    },
  );
  assert.match(local.backstory, /Farport/);
  assert.match(local.backstory, /Controls the customs vote\./);
  assert.match(local.history, /Western League/);
  assert.match(local.motivations, /Harbor Council/);

  const sparse = factionLore({}, {});
  assert.match(sparse.backstory, /This faction/);
  assert.doesNotMatch(sparse.backstory, /undefined/);

  const punctuated = factionLore({
    name: "Dock Wardens",
    note: "Keeps the harbor lights burning.",
  });
  assert.doesNotMatch(punctuated.backstory, /burning\.\./);
});

test("rivalries are reciprocal and positive standing shifts have consequences", () => {
  assert.equal(
    factionsAreRivals("Deep Delvers’ Union", "Black Hammer Compact"),
    true,
  );
  assert.equal(
    factionsAreRivals("Black Hammer Compact", "Deep Delvers’ Union"),
    true,
  );
  assert.deepEqual(factionRivals("Unaffiliated Factors"), []);
  assert.deepEqual(factionRivals(), []);
  const standings = { "Black Hammer Compact": 3 };
  assert.deepEqual(applyStandingChange(standings, "Deep Delvers’ Union", 7), {
    "Deep Delvers’ Union": 7,
    "Black Hammer Compact": -4,
  });
  assert.equal(standings["Black Hammer Compact"], -1);
  assert.deepEqual(applyStandingChange(standings, "Deep Delvers’ Union", 200), {
    "Deep Delvers’ Union": 93,
    "Black Hammer Compact": -99,
  });
  const fractional = {};
  applyStandingChange(fractional, "Pearl Senate", 0.1);
  assert.equal(fractional["Tideborn Commons"], -1);
});

test("rival contracts are mutually exclusive", () => {
  const contract = { faction: "Free Keel Brotherhood" };
  assert.match(
    contractConflict(contract, [{ faction: "Guild of Gilded Oars" }]),
    /will not share/,
  );
  assert.match(
    contractConflict(contract, [], "Guild of Gilded Oars"),
    /charter bars service/,
  );
  assert.equal(contractConflict(contract, [{ faction: "Pearl Senate" }]), null);
  assert.equal(contractConflict(contract, [], "Pearl Senate"), null);
});

test("a single high-standing charter closes rival doors", () => {
  const game = {
    factionStanding: {
      "Deep Delvers’ Union": 45,
      "Black Hammer Compact": 10,
    },
    factionCharter: null,
  };
  const result = chooseFactionCharter(game, "Deep Delvers’ Union");
  assert.equal(result.ok, true);
  assert.equal(game.factionCharter, "Deep Delvers’ Union");
  assert.equal(game.factionStanding["Black Hammer Compact"], -15);
  assert.equal(chooseFactionCharter(game, "Black Hammer Compact").ok, false);
  assert.equal(
    chooseFactionCharter(
      { factionStanding: { Minor: 44 }, factionCharter: null },
      "Minor",
    ).ok,
    false,
  );
  assert.equal(
    chooseFactionCharter({ factionStanding: {}, factionCharter: null }, "Minor")
      .ok,
    false,
  );
  const freshRival = {
    factionStanding: { "Guild of Gilded Oars": 45 },
    factionCharter: null,
  };
  assert.equal(
    chooseFactionCharter(freshRival, "Guild of Gilded Oars").changes[
      "Free Keel Brotherhood"
    ],
    -25,
  );
});
