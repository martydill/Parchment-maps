import test from "node:test";
import assert from "node:assert/strict";
import {
  SKY_GRADE_INK,
  STORM_ARC_STAGES,
  stormArc,
  stormArcForStage,
} from "../src/core/storm-arc.js";
import { sampleWeatherFront } from "../src/core/weather.js";

const clear = { name: "Clear", visibilityKm: 24, roughness: 0.08 };
const squall = { name: "Rain squalls", visibilityKm: 6.2, roughness: 0.5 };
const bright = { name: "Bright", visibilityKm: 18, roughness: 0.06 };
const mist = { name: "Sea mist", visibilityKm: 3.4, roughness: 0.16 };
const haze = { name: "High haze", visibilityKm: 9.5, roughness: 0.12 };

function arcAt(patterns, t, roughness = 0) {
  return stormArc({ front: sampleWeatherFront(patterns, t), roughness });
}

test("fair weather keeps every arc channel at rest", () => {
  const fair = arcAt([clear, clear], 0.5);
  assert.equal(fair.stage, "fair");
  assert.equal(fair.grade, 0);
  assert.equal(fair.ink, 0);
  assert.equal(fair.crew, 0);
  assert.equal(fair.birds, 1);
  assert.equal(fair.rainbow, 0);
  assert.equal(fair.gold, 0);
  assert.equal(fair.flicker, 0);
  assert.equal(fair.cadence, 8.7);
  const mistArc = arcAt([mist, mist], 0.5, 0.16);
  assert.equal(mistArc.grade, 0);
  assert.equal(mistArc.crew, 0);
  assert.ok(mistArc.stage === "fair" || mistArc.stage === "gathering");
});

test("the swell builds ahead of the squall as cloud leads the rain", () => {
  const early = arcAt([clear, squall], 0.3);
  const front = sampleWeatherFront([clear, squall], 0.3);
  // Storm and rain have barely arrived, but the swell is already climbing.
  assert.ok(early.swell > 0.3, `swell flat: ${early.swell}`);
  assert.ok(early.swell > front.storm * 2);
  assert.ok(early.birds > 0.9, "birds should linger through gathering");
  assert.ok(early.grade >= 1);
  assert.ok(early.stage !== "tempest");
  // Haze alone only nudges the sky one grade.
  const hazy = arcAt([haze, haze], 0.5, 0.12);
  assert.equal(hazy.stage, "gathering");
  assert.equal(hazy.grade, 1);
});

test("birds vanish and the crew scrambles before the squall arrives", () => {
  const mid = arcAt([clear, squall], 0.45);
  const front = sampleWeatherFront([clear, squall], 0.45);
  assert.ok(mid.birds < 0.05, `birds still present: ${mid.birds}`);
  assert.ok(mid.crew > 0.2, `crew idle: ${mid.crew}`);
  assert.ok(front.rain < 0.3, "squall rain should not have peaked yet");
  assert.ok(mid.stage !== "tempest");
});

test("a mature squall reads as tempest with a tight strike cadence", () => {
  const peak = arcAt([squall, squall], 0.5, 0.5);
  assert.equal(peak.stage, "tempest");
  assert.equal(peak.grade, 4);
  assert.equal(peak.ink, SKY_GRADE_INK[4]);
  assert.equal(peak.crew, 1);
  assert.equal(peak.birds, 0);
  assert.equal(peak.swell, 1);
  assert.equal(peak.cadence, 2.3);
  assert.equal(peak.gold, 0);
  assert.equal(peak.rainbow, 0);
});

test("strike cadence tightens stage by stage through the build", () => {
  const gathering = arcAt([clear, squall], 0.2);
  const brewing = arcAt([clear, squall], 0.4);
  const tempest = arcAt([clear, squall], 0.7);
  assert.ok(gathering.cadence > brewing.cadence);
  assert.ok(brewing.cadence > tempest.cadence);
  assert.ok(gathering.flicker < brewing.flicker);
  // Sheet lightning recedes once real strikes take over at the mature peak.
  const mature = arcAt([clear, squall], 0.92);
  assert.ok(mature.flicker < 0.5, `flicker persists: ${mature.flicker}`);
  assert.ok(mature.cadence <= tempest.cadence);
});

test("the front breaks into gold light before the rainbow arches", () => {
  const breaking = arcAt([squall, bright], 0.5, 0.3);
  assert.equal(breaking.stage, "breaking");
  assert.ok(breaking.gold > 0.6, `gold faint: ${breaking.gold}`);
  assert.ok(breaking.rainbow < 0.25, "rainbow must wait for the gold");
  const afterglow = arcAt([squall, bright], 0.8, 0.1);
  assert.equal(afterglow.stage, "afterglow");
  assert.ok(afterglow.rainbow > 0.6, `rainbow faint: ${afterglow.rainbow}`);
  assert.ok(afterglow.gold <= breaking.gold);
  // The sky lightens and the birds come back during the afterglow.
  assert.ok(afterglow.grade < breaking.grade);
  assert.ok(afterglow.birds > breaking.birds);
});

test("sky grade steps through the quantized ink table", () => {
  for (let cloud = 0; cloud <= 20; cloud++) {
    const arc = stormArc({ front: { cloud: cloud / 20 } });
    assert.equal(arc.ink, SKY_GRADE_INK[arc.grade]);
    assert.ok(arc.grade >= 0 && arc.grade <= 4);
  }
  assert.equal(stormArc({ front: { cloud: 0 } }).grade, 0);
  assert.equal(stormArc({ front: { cloud: 0.45 } }).grade, 1);
  assert.equal(stormArc({ front: { cloud: 0.9 } }).grade, 3);
  assert.equal(stormArc({ front: { cloud: 1, storm: 1 } }).grade, 4);
});

test("arc channels stay bounded for missing and malformed fronts", () => {
  for (const arc of [
    stormArc(),
    stormArc({ front: null }),
    stormArc({ front: {} }),
    stormArc({
      front: {
        storm: NaN,
        cloud: 5,
        rain: -2,
        lightning: 9,
        fog: 0.1,
        sunbreak: 3,
      },
      roughness: 99,
    }),
    stormArc({
      front: { storm: 1, cloud: 1, rain: 1, sunbreak: 1 },
      roughness: -4,
    }),
  ]) {
    assert.ok(STORM_ARC_STAGES.includes(arc.stage));
    for (const value of [
      arc.build,
      arc.swell,
      arc.crew,
      arc.flicker,
      arc.gold,
      arc.rainbow,
    ])
      assert.ok(value >= 0 && value <= 1, `channel out of range: ${value}`);
    assert.ok(arc.birds >= 0 && arc.birds <= 1);
    assert.ok(arc.cadence >= 2.3 && arc.cadence <= 8.7);
    assert.equal(arc.ink, SKY_GRADE_INK[arc.grade]);
  }
});

test("every stage fixture resolves back to its own stage", () => {
  for (const stage of STORM_ARC_STAGES) {
    const arc = stormArcForStage(stage);
    assert.equal(arc.stage, stage);
    assert.equal(arc.ink, SKY_GRADE_INK[arc.grade]);
  }
  assert.equal(stormArcForStage("nonsense").stage, "fair");
});
