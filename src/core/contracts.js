export function createContractOffer({
  origin,
  index,
  day,
  serial,
  destinations,
  cargoNames,
  getPort,
  distanceBetween,
}) {
  const destinationName =
    destinations[(index + day + origin.name.length) % destinations.length];
  const destination = getPort(destinationName);
  const distance = distanceBetween(destination, origin);
  const courier = index === 1;
  const cargoUnits = courier ? 1 : 2 + ((day + index + origin.name.length) % 3);
  const cargoName = courier
    ? "sealed diplomatic pouch"
    : cargoNames[(day * 3 + index + origin.name.length) % cargoNames.length];
  const sponsor =
    origin.name === "Goldhaven"
      ? "Guild of Gilded Oars"
      : origin.factions[Math.min(1, index % origin.factions.length)].name;

  return {
    offer: {
      id: `C${serial}`,
      origin: origin.name,
      destination: destinationName,
      title: `${courier ? "Urgent dispatch" : "Cargo commission"} to ${destinationName}`,
      cargoName,
      cargoUnits,
      reward: Math.round(
        45 + distance * 0.07 + cargoUnits * 9 + (courier ? 20 : 0),
      ),
      influence: origin.name === "Goldhaven" ? 8 : 5 + index,
      faction: sponsor,
      estimatedDays: Math.max(2, Math.ceil(distance / 430)),
      acceptedDay: null,
      deadline: null,
    },
    nextSerial: serial + 1,
  };
}

export function contractOffersForPort({
  cache,
  day,
  createOffer,
  offerCount = 3,
  refreshDays = 4,
}) {
  if (cache && day - cache.refreshedDay < refreshDays) return cache;

  return {
    refreshedDay: day,
    offers: Array.from({ length: offerCount }, (_, index) =>
      createOffer(index),
    ),
  };
}

export function contractCargoCount(contracts) {
  return contracts.reduce((sum, contract) => sum + contract.cargoUnits, 0);
}
