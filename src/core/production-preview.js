import { chooseRecipe } from "./regional.js";

// A preview of one batch for the next cycle, rather than a claim about daily
// output. The simulation can run fractional batches and apply labor/quality.
export function productionPreview(chain, states) {
  const recipe = chooseRecipe(states, chain);
  const requirements = { ...recipe.inputs };
  if (chain.fuel) requirements.timber = (requirements.timber || 0) + chain.fuel;
  const inputs = Object.entries(requirements).map(([key, required]) => {
    const stock = Math.max(0, states[key]?.stock ?? 0);
    return {
      key,
      required,
      stock,
      shortfall: Math.max(0, required - stock),
      fuel: key === "timber" && Boolean(chain.fuel),
    };
  });
  return {
    recipeId: recipe.id,
    recipeLabel: recipe.label || "Standard recipe",
    inputs,
    outputs: Object.entries(chain.outputs).map(([key, units]) => ({
      key,
      units: units * recipe.outputScale,
    })),
    limited: inputs.some((input) => input.shortfall > 0),
  };
}
