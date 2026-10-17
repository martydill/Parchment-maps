// Setting even identical textContent replaces text nodes and dirties layout.
// Read the actual property so updates elsewhere cannot leave a stale cache.
export function updateElementProperty(element, property, value) {
  if (element[property] !== value) element[property] = value;
}
