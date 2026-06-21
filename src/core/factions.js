import { PORT_NAMES, FACTION_NAMES } from "../names.js";
import { clamp } from "./math.js";

const RIVAL_PAIRS = Object.freeze([
  [FACTION_NAMES.deepDelversUnion, FACTION_NAMES.blackHammerCompact],
  [FACTION_NAMES.syrrelwakeOarwrightPact, FACTION_NAMES.freeKeelBrotherhood],
  [FACTION_NAMES.pearlSenate, FACTION_NAMES.tidebornCommons],
  [FACTION_NAMES.silverLoomConsortium, "Reedboat Families"],
  [FACTION_NAMES.lanternLeague, FACTION_NAMES.mirrorKnives],
  [FACTION_NAMES.diversCommunion, "Velvet Circle"],
]);

const FACTION_LORE = Object.freeze({
  [FACTION_NAMES.deepDelversUnion]: Object.freeze({
    backstory:
      "The Union began as a secret compact among shaft crews who tied black cord around their wrists so rescuers could identify them after a collapse. It now binds miners, surveyors, haulers, and the widows who administer its relief halls.",
    history: `After the Nine-Day Cave-In, the delvers stopped every lift in ${PORT_NAMES.drazhOvek} until the forge-lords accepted elected safety wardens. Export duties later funded rescue stations, but repeated attempts to divert that money have kept the Union in conflict with mine owners and the ${FACTION_NAMES.blackHammerCompact}.`,
    motivations:
      "It seeks enforceable safety rules, worker control of new mineral finds, and a permanent share of ore revenues for injured crews and mining settlements. Its leaders will support expansion only when those who descend into the earth share in the reward.",
  }),
  [FACTION_NAMES.blackHammerCompact]: Object.freeze({
    backstory: `The Compact is an alliance of northern mine proprietors, master armorers, and furnace creditors whose stamped black-hammer mark guarantees metal from pit to finished blade. Its members see disciplined ownership as the foundation of ${PORT_NAMES.narthkel}’s survival.`,
    history: `It rose during the Lean Winters by keeping the fortress forges burning when public stores failed. War contracts made its founders wealthy, and their purchase of exhausted mines brought them into direct competition with the organizing delvers of ${PORT_NAMES.drazhOvek}.`,
    motivations:
      "The Compact wants unrestricted access to ore, predictable labor, stronger naval procurement, and fortified trade routes. It opposes any union or council able to halt production, especially the Deep Delvers’ Union.",
  }),
  [FACTION_NAMES.syrrelwakeOarwrightPact]: Object.freeze({
    backstory: `The Guild descends from six merchant households that financed ${PORT_NAMES.orvessaQuay}’s first blue-water convoy. A gilded oar above a countinghouse door promises credit, escorts, and influence in nearly every major customs hall.`,
    history:
      "Guild loans rebuilt the royal fleet after the War of Broken Masts, earning its dynasties hereditary concessions and tariff exemptions. As independent captains multiplied, the Guild converted old privileges into a web of bonded warehouses and exclusive route charters.",
    motivations:
      "It wants stable law, lower duties, protected sea lanes, and first claim on profitable discoveries. The Guild treats commerce as public order and regards the Free Keel Brotherhood’s unlicensed competition as piracy dressed in romantic language.",
  }),
  [FACTION_NAMES.freeKeelBrotherhood]: Object.freeze({
    backstory:
      "The Brotherhood is less a formal guild than a covenant exchanged between captains who own, crew, or owe no permanent allegiance over their vessels. Its taverns provide arbitration, emergency loans, and berths for sailors fleeing abusive contracts.",
    history: `It formed when twelve packet captains refused ${PORT_NAMES.narthkel}’s compulsory naval levy and escaped through an uncharted winter channel. Their success inspired free captains across the archipelago to share routes and resist merchant monopolies.`,
    motivations: `The Brotherhood fights for open harbors, portable crew shares, freedom from forced service, and public access to navigational discoveries. It distrusts every exclusive charter, particularly those enforced by the ${FACTION_NAMES.syrrelwakeOarwrightPact}.`,
  }),
  [FACTION_NAMES.pearlSenate]: Object.freeze({
    backstory: `The Senate grew from the ship-owning clans that financed ${PORT_NAMES.mirravel}’s first permanent diving platforms. Seats are elected, but expensive eligibility rules ensure that pearl fleets and old canal houses dominate debate.`,
    history: `Following the Drowning of Old ${PORT_NAMES.mirravel}, the clans paid for sea walls and received authority to auction beds, berths, and salvage rights. Success made the isles rich while concentrating debt and the safest waters in senatorial hands.`,
    motivations: `It seeks to preserve auction revenues, family fleets, and ${PORT_NAMES.mirravel}’s independence from foreign crowns. Senators favor growth but resist debt limits and communal claims advanced by the ${FACTION_NAMES.tidebornCommons}.`,
  }),
  [FACTION_NAMES.tidebornCommons]: Object.freeze({
    backstory:
      "The Commons unites dock wards, fishing crews, chandlers, and families whose homes stand below the spring-tide line. Its assemblies meet on public quays so no landlord or shipowner can close the doors.",
    history:
      "Bread riots during the Three Empty Tides became an organized relief fleet and then a political movement. The Commons won public grain scales and storm pensions, but failed to break the great houses’ control of fisheries and harbor land.",
    motivations:
      "It demands affordable food, safe quays, common fishing grounds, and a voice for working districts in trade policy. It opposes the Pearl Senate whenever private auctions place survival resources beyond ordinary crews.",
  }),
  [FACTION_NAMES.silverLoomConsortium]: Object.freeze({
    backstory: `The Consortium joins ${PORT_NAMES.velquorin}’s cocoon growers, dyers, loom houses, and overseas silk factors. Its silver thread seal certifies both the origin of Starweave and the long chain of credit behind every bolt.`,
    history:
      "Once subordinate to hereditary court guilds, the loom houses gained leverage by supplying sails and bandages during the Moonroad War. They then opened foreign depots, displacing independent reed-cloth traders and provoking generations of resentment.",
    motivations:
      "It wants convoy protection, open luxury markets, strict control of the Starweave name, and dependable supplies of fiber and dye. It views the Reedboat Families’ informal trade as both commercial theft and a threat to quality.",
  }),
  "Reedboat Families": Object.freeze({
    backstory:
      "These intermarried boat clans carry cloth, herbs, messages, and people through channels too shallow for a customs launch. Kinship, remembered favors, and spoken route lore matter more to them than stamped contracts.",
    history:
      "The families survived successive marsh enclosures by moving whole workshops onto reed barges. When the Silver Loom Consortium claimed exclusive rights over fine fiber trade, they built a quiet counter-market linking isolated villages and urban artisans.",
    motivations:
      "They defend customary waterways, family workshops, debt-free exchange, and the right to sell cloth without distant guild approval. Their struggle with the Consortium is about cultural survival as much as market access.",
  }),
  [FACTION_NAMES.lanternLeague]: Object.freeze({
    backstory:
      "The League began with scholars and harbor clerks who met beneath one hooded lantern to compare censored charts and tax ledgers. Printers, minor nobles, teachers, and reform-minded officers have since turned it into a public movement.",
    history: `Its exposure of the False Beacon Scandal forced ${PORT_NAMES.orvessaQuay} to publish harbor accounts and standardize pilots’ examinations. Later investigations into vanished cargoes made the League the enduring enemy of smugglers protected by official patronage.`,
    motivations: `It pursues transparent government, public charts, educated navigation, and laws applied equally to crown agents and private merchants. The League considers the ${FACTION_NAMES.mirrorKnives} proof that secrecy inevitably corrupts institutions.`,
  }),
  [FACTION_NAMES.mirrorKnives]: Object.freeze({
    backstory:
      "The Knives are a loose confederacy of smugglers, privateers, fences, and compromised customs officers. Members carry slivers of mirrored glass rather than badges, recognizing one another through debts and carefully traded secrets.",
    history:
      "They emerged when wartime blockades made legal commerce impossible and island pilots began moving medicine after dark. Peace transformed necessity into a lucrative shadow network, while repeated Lantern League inquiries drove its cells deeper into official life.",
    motivations:
      "The Knives seek profitable ambiguity: selective enforcement, hidden anchorages, deniable violence, and officials who can be bought. They resist the Lantern League because published records and honest inspections would dismantle their greatest asset—uncertainty.",
  }),
  [FACTION_NAMES.diversCommunion]: Object.freeze({
    backstory:
      "The Communion is a network of diving crews, healers, rope tenders, and bereaved households organized around shared air bells and mutual-aid chests. Its rituals honor those whose bodies the sea never returned.",
    history: `After pearl masters abandoned dozens of trapped divers during the Red Bloom, surviving crews pooled their earnings to pay debts and rescue families. Their lodges spread through ${PORT_NAMES.mirravel} and won limits on the cruelest diving contracts.`,
    motivations:
      "It seeks safe equipment, transparent weights, debt ceilings, survivor pensions, and communal rights to newly found beds and wrecks. The Communion opposes the Velvet Circle’s appetite for luxury when fashion hides the human cost of pearls.",
  }),
  "Velvet Circle": Object.freeze({
    backstory:
      "The Circle gathers court designers, jewelers, patrons, actors, and discreet brokers who decide what Kingfisher society will desire next season. Invitations are scarce, but a favorable salon whisper can redirect an entire trade route.",
    history:
      "It first formed to protect artists from ducal sumptuary laws, then became powerful by turning foreign materials into symbols of rank. Its demand for rare pearls and coral enriched the court while encouraging dangerous diving and opaque supply chains.",
    motivations:
      "The Circle wants unrestricted access to exquisite materials, freedom from moral regulation, and cultural influence over every wealthy court. It dismisses the Divers’ Communion’s restrictions as provincial interference with art and commerce.",
  }),
});

function sentence(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function factionLore(faction, port = {}) {
  if (FACTION_LORE[faction.name]) return FACTION_LORE[faction.name];

  const name = faction.name || "This faction";
  const home = port.name || "its home port";
  const realm = port.realm || "the surrounding realm";
  const foundation = sentence(faction.note);
  return {
    backstory: `${name} grew from the people and institutions whose livelihoods depend most directly on ${home}. ${foundation} Its identity is sustained by local loyalties, practical favors, and a shared belief that outsiders misunderstand what the port requires.`,
    history: `Generations of bargaining over ${home}’s trade, laws, and defenses turned an informal interest group into an organized political force. It has survived changes in rulers and prosperity by making itself useful to ${realm}, while remembering every concession won and every promise broken.`,
    motivations: `${name} aims to expand its influence over harbor policy, protect the supporters described in its founding cause, and secure a larger share of the port’s future wealth. It will cooperate with rivals when ${home} is threatened, but otherwise judges captains by whether their actions strengthen its people, independence, and long-term authority.`,
  };
}

export const FACTION_RIVALRIES = Object.freeze(
  RIVAL_PAIRS.reduce((relationships, [left, right]) => {
    relationships[left] = Object.freeze([right]);
    relationships[right] = Object.freeze([left]);
    return relationships;
  }, {}),
);

export function factionRivals(faction) {
  return FACTION_RIVALRIES[faction] || [];
}

export function factionsAreRivals(left, right) {
  return factionRivals(left).includes(right);
}

export function applyStandingChange(standings, faction, amount) {
  const changes = {};
  const previous = Number(standings[faction] || 0);
  standings[faction] = clamp(previous + amount, -100, 100);
  changes[faction] = standings[faction] - previous;

  if (amount > 0) {
    const rivalLoss = Math.max(1, Math.ceil(amount / 2));
    for (const rival of factionRivals(faction)) {
      const rivalPrevious = Number(standings[rival] || 0);
      standings[rival] = clamp(rivalPrevious - rivalLoss, -100, 100);
      changes[rival] = standings[rival] - rivalPrevious;
    }
  }

  return changes;
}

export function contractConflict(contract, activeContracts, charter = null) {
  if (charter && factionsAreRivals(contract.faction, charter))
    return `Your ${charter} charter bars service to ${contract.faction}.`;
  const conflict = activeContracts.find((active) =>
    factionsAreRivals(contract.faction, active.faction),
  );
  return conflict
    ? `${contract.faction} will not share your service with ${conflict.faction}.`
    : null;
}

export function chooseFactionCharter(game, faction) {
  if (game.factionCharter)
    return {
      ok: false,
      reason: `Already chartered to ${game.factionCharter}.`,
    };
  if ((game.factionStanding[faction] || 0) < 45)
    return { ok: false, reason: "A formal charter requires 45 standing." };

  game.factionCharter = faction;
  const changes = {};
  for (const rival of factionRivals(faction)) {
    const previous = Number(game.factionStanding[rival] || 0);
    game.factionStanding[rival] = clamp(previous - 25, -100, 100);
    changes[rival] = game.factionStanding[rival] - previous;
  }
  return { ok: true, faction, changes };
}
