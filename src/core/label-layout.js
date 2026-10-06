function intersects(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// Sailing labels stay below their town. Clip at the viewport instead of moving
// them around ships, other labels, or the HUD as the camera moves.
export function anchorMapLabels(labels, width, height) {
  const viewport = { x: 0, y: 0, width, height };
  return labels
    .map((label) => ({
      ...label,
      x: label.x - label.width / 2,
      y: label.y + 18,
    }))
    .filter((label) => intersects(label, viewport));
}

// Labels are placed in screen pixels so their type remains crisp at every zoom.
export function layoutMapLabels(labels, blockers, width, height) {
  const occupied = [...blockers];
  const placed = [];
  for (const label of [...labels].sort((a, b) => b.priority - a.priority)) {
    const positions = [
      [label.x - label.width / 2, label.y + 18],
      [label.x - label.width / 2, label.y - label.height - 20],
      [label.x + 19, label.y - label.height / 2],
      [label.x - label.width - 19, label.y - label.height / 2],
      [label.x - label.width / 2, label.y + 54],
      [label.x - label.width / 2, label.y - label.height - 54],
    ];
    for (const [x, y] of positions) {
      const box = { x, y, width: label.width, height: label.height };
      if (
        x < 8 ||
        y < 8 ||
        x + label.width > width - 8 ||
        y + label.height > height - 8 ||
        occupied.some((other) => intersects(box, other))
      )
        continue;
      occupied.push(box);
      placed.push({ ...label, ...box });
      break;
    }
  }
  return placed;
}
