export function activateSectionTabs(root, name) {
  if (!root) return;
  root
    .querySelectorAll(".port-tab")
    .forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === name));
  root
    .querySelectorAll(".port-panel")
    .forEach((panel) =>
      panel.classList.toggle("active", panel.dataset.tab === name),
    );
  const body = root.querySelector(".port-body");
  if (body) body.scrollTop = 0;
}
