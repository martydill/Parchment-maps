import test from "node:test";
import assert from "node:assert/strict";
import { sailStitchLines } from "../src/core/ship-materials.js";

test("seams follow a bowed cloth surface at fixed model-space intervals", () => {
  const triangle = [
    [-6, 0, 10],
    [6, 0, 10],
    [0, 4, 0],
  ];
  const lines = sailStitchLines(triangle);
  assert.deepEqual(lines, [
    [
      [-3, 0, 10],
      [-3, 2, 5],
    ],
    [
      [0, 0, 10],
      [0, 4, 0],
    ],
    [
      [3, 0, 10],
      [3, 2, 5],
    ],
  ]);
  assert.deepEqual(sailStitchLines(triangle), lines);
  const reversed = sailStitchLines(triangle.toReversed());
  const normalize = (segments) =>
    segments.map((line) => line.toSorted((a, b) => a[1] - b[1] || a[2] - b[2]));
  assert.deepEqual(normalize(reversed), normalize(lines));
});

test("neighboring sail triangles meet at the same seam station", () => {
  const upper = sailStitchLines([
    [-6, 0, 10],
    [6, 0, 10],
    [0, 4, 0],
  ]);
  const lower = sailStitchLines([
    [-6, 0, 10],
    [6, 0, 10],
    [0, -4, 20],
  ]);
  assert.deepEqual(
    upper.map(([edge]) => edge),
    lower.map(([edge]) => edge),
  );
});

test("narrow and edge-on cloth avoids duplicate or zero-length seams", () => {
  assert.deepEqual(
    sailStitchLines([
      [1, 0, 0],
      [2, 0, 3],
      [1, 0, 3],
    ]),
    [],
  );
  assert.deepEqual(
    sailStitchLines([
      [0, 0, 0],
      [0, 0, 3],
      [0, 2, 3],
    ]),
    [],
  );
  assert.deepEqual(
    sailStitchLines([
      [0, 0, 0],
      [2, 0, 3],
      [2, 2, 3],
    ]),
    [],
  );
  assert.deepEqual(
    sailStitchLines([
      [0, 0, 0],
      [0, 0, 3],
      [3, 2, 3],
    ]),
    [
      [
        [0, 0, 3],
        [0, 0, 0],
      ],
    ],
  );
});
