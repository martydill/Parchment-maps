import assert from "node:assert/strict";
import test from "node:test";
import { productionPreview } from "../src/core/production-preview.js";

const chain = {
  inputs: { ore: 1.5 },
  outputs: { iron: 1 },
  fuel: 0.2,
};

test("previews a batch with fuel without changing stock or the recipe", () => {
  const states = { ore: { stock: 3 }, timber: { stock: 1 } };
  const before = structuredClone({ chain, states });
  assert.deepEqual(productionPreview(chain, states), {
    recipeId: "standard",
    recipeLabel: "Standard recipe",
    inputs: [
      { key: "ore", required: 1.5, stock: 3, shortfall: 0, fuel: false },
      { key: "timber", required: 0.2, stock: 1, shortfall: 0, fuel: true },
    ],
    outputs: [{ key: "iron", units: 1 }],
    limited: false,
  });
  assert.deepEqual({ chain, states }, before);
});

test("combines timber inputs with fuel to reveal the full requirement", () => {
  const preview = productionPreview(
    { ...chain, inputs: { timber: 1 } },
    { timber: { stock: 1.1 } },
  );
  assert.equal(preview.inputs[0].required, 1.2);
  assert.ok(Math.abs(preview.inputs[0].shortfall - 0.1) < 1e-12);
  assert.equal(preview.limited, true);
});

test("handles exact requirements, fractional stock, missing stock and depleted stock", () => {
  assert.equal(
    productionPreview(chain, { ore: { stock: 1.5 }, timber: { stock: 0.2 } })
      .limited,
    false,
  );
  const preview = productionPreview(chain, { ore: { stock: 0.5 } });
  assert.equal(preview.inputs[0].shortfall, 1);
  assert.equal(preview.inputs[1].stock, 0);
  assert.equal(preview.inputs[1].shortfall, 0.2);
  assert.equal(
    productionPreview(chain, { ore: { stock: -1 }, timber: {} }).inputs[0]
      .stock,
    0,
  );
});

test("uses the simulation's alternative recipe and its output multiplier", () => {
  const preview = productionPreview(
    {
      ...chain,
      fuel: 0,
      alternatives: [
        {
          id: "scrap",
          label: "Scrap remelting",
          inputs: { scrap: 1 },
          outputScale: 0.7,
        },
      ],
    },
    { ore: { stock: 0 }, scrap: { stock: 4 } },
  );
  assert.equal(preview.recipeId, "scrap");
  assert.equal(preview.recipeLabel, "Scrap remelting");
  assert.deepEqual(preview.inputs, [
    { key: "scrap", required: 1, stock: 4, shortfall: 0, fuel: false },
  ]);
  assert.deepEqual(preview.outputs, [{ key: "iron", units: 0.7 }]);
  assert.equal(preview.limited, false);
});

test("does not invent fuel consumption for a recipe with no fuel", () => {
  const preview = productionPreview(
    { inputs: { grain: 1 }, outputs: { provisions: 1, herbs: 0.5 } },
    { grain: { stock: 2 } },
  );
  assert.equal(preview.inputs.length, 1);
  assert.equal(preview.inputs[0].fuel, false);
  assert.equal(preview.outputs.length, 2);
});
