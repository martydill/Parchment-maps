// Setting even identical textContent replaces text nodes and dirties layout.
// Read the actual property so updates elsewhere cannot leave a stale cache.
export function updateElementProperty(element, property, value) {
  if (element[property] !== value) element[property] = value;
}

// Refresh dirty bounds before frame writes; rendering only consumes the cache.
export function createElementBoundsCache(elements) {
  const bounds = new Map();
  const dirty = new Set(elements);
  return {
    invalidate(element) {
      if (element) dirty.add(element);
      else for (const element of elements) dirty.add(element);
    },
    refresh() {
      for (const element of dirty) {
        const rect = element.getBoundingClientRect();
        bounds.set(
          element,
          rect.width
            ? {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height,
              }
            : null,
        );
      }
      dirty.clear();
    },
    get(element) {
      return bounds.get(element);
    },
  };
}
