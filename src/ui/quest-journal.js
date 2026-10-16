import {
  QUEST_CHAINS,
  QUESTS,
  claimQuestReward,
  questJournal,
  trackQuest,
} from "../core/quests.js";

export function renderQuestJournal(root, { game, onChange, onMessage }) {
  const doc = root.ownerDocument;
  const journal = questJournal(game);
  root.replaceChildren();
  const element = (tag, text, className) => {
    const node = doc.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const completed = journal.filter((item) => item.completed).length;
  const ready = journal.filter((item) => item.ready).length;
  root.append(
    element(
      "p",
      `${completed}/${QUESTS.length} quests complete · ${ready} reward${ready === 1 ? "" : "s"} ready`,
      "quest-summary",
    ),
  );
  for (const chain of QUEST_CHAINS) {
    const group = element("section", null, "quest-chain");
    group.setAttribute("aria-label", chain.title);
    group.append(
      element("h4", chain.title),
      element("p", chain.description, "small"),
    );
    for (const item of journal.filter((entry) => entry.chain === chain.id)) {
      const status = item.completed
        ? "Completed"
        : item.locked
          ? "Locked"
          : item.ready
            ? "Reward ready"
            : item.tracked
              ? "Tracking"
              : "Available";
      const card = element(
        "article",
        null,
        `quest-card ${item.completed ? "done" : item.locked ? "locked" : item.ready ? "ready" : "available"}`,
      );
      card.dataset.questId = item.id;
      const header = element("div", null, "quest-heading");
      header.append(
        element("h5", item.title),
        element("span", status, "contract-tag"),
      );
      card.append(header, element("p", item.detail, "small"));
      const progress = element("progress");
      progress.max = item.target;
      progress.value = item.progress;
      progress.setAttribute(
        "aria-label",
        `${item.title}: ${item.progress} of ${item.target}`,
      );
      card.append(
        progress,
        element(
          "p",
          `${item.progress}/${item.target} · ${item.reward} crowns${item.completed ? " collected" : " reward"}`,
          "small",
        ),
      );
      if (item.locked) {
        const previous = QUESTS.find((entry) => entry.id === item.requires);
        card.append(
          element(
            "p",
            `Collect the reward for “${previous.title}” to unlock.`,
            "small",
          ),
        );
      } else if (!item.completed) {
        const actions = element("div", null, "quest-actions");
        const track = element(
          "button",
          item.tracked ? "Stop tracking" : "Track quest",
          "parchment",
        );
        track.type = "button";
        track.setAttribute("aria-pressed", String(item.tracked));
        track.addEventListener("click", () => {
          trackQuest(game, item.id);
          onChange();
          root.querySelector(`[data-quest-id="${item.id}"] button`).focus();
        });
        actions.append(track);
        if (item.ready) {
          const claim = element(
            "button",
            `Collect ${item.reward} crowns`,
            "parchment",
          );
          claim.type = "button";
          claim.addEventListener("click", () => {
            const result = claimQuestReward(game, item.id);
            onMessage(
              result.ok
                ? `${item.title} complete. +${item.reward} crowns.`
                : result.reason,
            );
            onChange();
            const next = root.querySelector(
              ".quest-card.ready button, .quest-card.available button",
            );
            if (next) next.focus();
          });
          actions.append(claim);
        }
        card.append(actions);
      }
      group.append(card);
    }
    root.append(group);
  }
}
