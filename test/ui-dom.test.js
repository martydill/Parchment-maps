import assert from "node:assert/strict";
import test from "node:test";
import { updateElementProperty } from "../src/ui/dom.js";

test("unchanged HUD properties do not trigger DOM writes", () => {
  const values = {
    textContent: "0.0 knots",
    className: "normal",
    hidden: false,
    title: "Course",
  };
  const writes = [];
  const element = new Proxy(values, {
    set(target, property, value) {
      writes.push(property);
      target[property] = value;
      return true;
    },
  });
  for (let frame = 0; frame < 60; frame++) {
    for (const [property, value] of Object.entries(values))
      updateElementProperty(element, property, value);
  }
  assert.deepEqual(writes, []);
  updateElementProperty(element, "textContent", "1.2 knots");
  updateElementProperty(element, "hidden", true);
  assert.deepEqual(writes, ["textContent", "hidden"]);
  assert.equal(values.textContent, "1.2 knots");
  assert.equal(values.hidden, true);
});

test("HUD updates honor changes made elsewhere in the UI", () => {
  const element = { textContent: "At anchor" };
  updateElementProperty(element, "textContent", "Sailing");
  element.textContent = "Docked";
  updateElementProperty(element, "textContent", "Sailing");
  assert.equal(element.textContent, "Sailing");
});
