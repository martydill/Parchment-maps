export function activateSectionTabs(root, name) {
  if (!root) return;
  root.querySelectorAll(".port-tab").forEach((btn) => {
    const selected = btn.dataset.tab === name;
    btn.classList.toggle("active", selected);
    btn.setAttribute("aria-selected", String(selected));
    btn.tabIndex = selected ? 0 : -1;
    btn.id ||= `${root.id}-tab-${btn.dataset.tab}`;
    btn.setAttribute("aria-controls", `${root.id}-section-${btn.dataset.tab}`);
  });
  root.querySelectorAll(".port-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.tab === name);
    panel.id ||= `${root.id}-section-${panel.dataset.tab}`;
    panel.setAttribute(
      "aria-labelledby",
      `${root.id}-tab-${panel.dataset.tab}`,
    );
  });
  const body = root.querySelector(".port-body");
  if (body) body.scrollTop = 0;
}
