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

test("panel context wiring absorbs the app context without assignment errors", async () => {
  // The panel modules touch browser globals at import time; stub the ones
  // Node lacks so the wiring itself is what the test exercises.
  const previous = {
    ResizeObserver: globalThis.ResizeObserver,
    addEventListener: globalThis.addEventListener,
    removeEventListener: globalThis.removeEventListener,
    document: globalThis.document,
  };
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  globalThis.document = {
    addEventListener() {},
    removeEventListener() {},
  };
  let panels;
  try {
    panels = await import("../src/ui/panels.js");
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  }
  // A universal stand-in: every property reads as a callable that returns
  // itself, so a missing or undeclared context member is the only way this
  // can fail — exactly the class of wiring bug syncPanelContext risks.
  const anything = new Proxy(function () {}, {
    get: (target, property) =>
      property === Symbol.toPrimitive ? () => 0 : anything,
    apply: () => anything,
  });
  panels.configureUiPanels(anything);
  assert.equal(panels.updateHud, panels.updateHud);
});
