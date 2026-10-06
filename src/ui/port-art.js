// Small engraved illustrations share the port's ink, brass, and watercolor palette.
// These are decorative; the adjacent labels carry every gameplay meaning.
import { vesselIllustration } from "./vessel-art.js?v=2";

const paths = {
  city: '<path d="M3 21h26M6 21V10l6-5 6 5v11M18 21V13l5-4 5 4v8M10 21v-7h4v7M9 10h6M22 14h3"/>',
  systems:
    '<path d="M3 20h26l-5 7H9zM16 20V3M16 5l10 12H16M13 7L5 17h8M5 29q3-2 6 0t6 0t6 0t6 0"/>',
  cargo:
    '<path d="m4 12 12-7 12 7v14H4zM4 12l12 7 12-7M16 19v7M10 8l12 7M10 16v10"/>',
  market:
    '<path d="M4 13h24M7 13v14h18V13M4 13l3-8h18l3 8M12 5l-1 8M20 5l1 8M11 27v-8h10v8"/>',
  guild:
    '<path d="M7 5h18v24H7zM11 10h10M11 14h10M11 18h6"/><circle cx="21" cy="23" r="4"/><path d="m18 26-1 5 4-2 4 2-1-5"/>',
  council:
    '<path d="m16 3 11 5v9c0 6-11 12-11 12S5 23 5 17V8zM16 7v17M9 12h14M11 18h10"/>',
  crew: '<circle cx="16" cy="10" r="5"/><path d="M6 28v-7q10-8 20 0v7M11 19l5 5 5-5M16 24v4"/>',
  warehouse:
    '<path d="M3 13 16 4l13 9M6 11v18h20V11M11 29V17h10v12M11 21h10M16 17v12"/>',
  customs:
    '<path d="M8 3h16v26H8zM12 9h8M12 13h8M12 17h4"/><circle cx="22" cy="24" r="6"/><path d="m19 24 2 2 4-4"/>',
  passage:
    '<circle cx="16" cy="16" r="12"/><path d="m21 9-3 9-8 5 4-10zM16 1v3M16 28v3M1 16h3M28 16h3"/>',
  rumors:
    '<path d="m5 21 15-12 5 6-15 12zM20 9l3-3 5 6-3 3M5 21l-3 3 5 6 3-3M17 23l4 7M19 24l5-3"/>',
  workshops:
    '<path d="M4 28V14l8 5v-8l8 6V5h5v23zM8 24h3M15 24h3M21 22h3M20 2h5"/>',
  fittings:
    '<path d="M21 4a7 7 0 0 0-9 9L3 23l6 6 10-10a7 7 0 0 0 9-9l-6 4-4-4z"/>',
  fleet:
    '<path d="M2 22h16l-3 6H5zM10 22V10l7 9h-7M17 13h13l-3 5h-6zM23 13V3l6 8h-6"/>',
  milestone:
    '<circle cx="16" cy="12" r="8"/><path d="m11 19-3 11 8-4 8 4-3-11M16 7l2 3 4 1-3 3v4l-3-2-3 2v-4l-3-3 4-1z"/>',
};

export function menuGlyph(name) {
  return `<svg class="menu-glyph" viewBox="0 0 32 32" aria-hidden="true" focusable="false">${paths[name] || paths.guild}</svg>`;
}

export function heraldry(index = 0) {
  const colors = ["#655d45", "#8a513b", "#4e6c63", "#6c6680"];
  const emblems = [
    '<path d="m44 28 7 13 15 2-11 10 3 15-14-7-14 7 3-15-11-10 15-2z"/>',
    '<path d="M26 38h36l-5 23H31zM30 38l-3-11 12 9 5-14 5 14 12-9-3 11M33 67h22"/>',
    '<path d="M44 27v39M35 33h18M26 50q0 19 18 19t18-19M26 50l-5 6M62 50l5 6"/><circle cx="44" cy="26" r="5"/>',
    '<path d="M30 31h28v31H30zM44 31v31M35 37h5M48 37h5M35 44h5M48 44h5M35 51h5M48 51h5"/>',
  ];
  const key = Math.abs(index) % colors.length;
  return `<svg class="heraldic-art" viewBox="0 0 88 100" aria-hidden="true" focusable="false"><path d="M11 8q33 9 66 0v48q-2 22-33 39Q13 78 11 56z" fill="${colors[key]}" stroke="#9c8054" stroke-width="2"/><path d="M17 16q27 6 54 0v39q-1 18-27 32Q18 73 17 55z" fill="none" stroke="#e5d0a4" opacity=".7"/><g fill="none" stroke="#eddbb7" stroke-width="2" stroke-linejoin="round">${emblems[key]}</g></svg>`;
}

export function crewPortrait(role = "deck") {
  const key = role.toLowerCase();
  const marine = key.includes("marine");
  const artisan = key.includes("artisan");
  const steward = key.includes("steward");
  const coat = marine
    ? "#764b3d"
    : artisan
      ? "#68634e"
      : steward
        ? "#586b66"
        : "#556c79";
  const hat = marine
    ? '<path d="m44 46 5-25h22l6 25z" fill="#6c4936"/><path d="M50 24h20M51 33h18" stroke="#c9a46a"/><path d="m61 18 4 7-4 4-4-4z" fill="#b79962"/>'
    : artisan
      ? '<path d="M44 44q0-26 18-25 20 0 20 27z" fill="#6c6249"/><path d="M41 45h43" stroke="#443d2e" stroke-width="4"/>'
      : steward
        ? '<path d="M45 39q6-24 24-16l9 16" fill="#6d5944"/><path d="M45 37q12-14 31 0" stroke="#403426"/>'
        : '<path d="M42 42q0-15 21-17 14 0 18 17l-10 4H50z" fill="#657378"/><path d="M39 43h44" stroke="#3d4b51" stroke-width="4"/>';
  return `<svg class="crew-portrait" viewBox="0 0 124 132" aria-hidden="true" focusable="false"><ellipse cx="62" cy="72" rx="50" ry="57" fill="#dfcfad"/><path d="M18 132q-1-44 32-52h25q29 12 32 52" fill="${coat}" stroke="#574936" stroke-width="1.5"/><path d="m48 84 14 19 16-19M62 102v30" fill="none" stroke="#cbb997" stroke-width="2"/><path d="M48 37q14-10 28 1l-1 31q-4 17-13 17-11 0-15-18z" fill="#c9a57b" stroke="#715b40" stroke-width="1.4"/><path d="M46 50q-8-5-5 8l6 8M76 50q8-5 5 8l-6 8" fill="#c9a57b" stroke="#715b40"/><path d="M52 52h6M67 52h6M63 52l-2 11 5 1M55 72q8 4 15-1" fill="none" stroke="#725b43" stroke-width="1.4"/>${hat}${steward ? '<g fill="none" stroke="#544b37"><circle cx="54" cy="53" r="6"/><circle cx="71" cy="53" r="6"/><path d="M60 52h5"/></g>' : '<path d="M48 65q13 15 26 0l-3 14-10 6-10-7z" fill="#66513e" opacity=".65"/>'}<path d="M25 130l5-28M99 130l-4-29" stroke="#eee0ba" opacity=".4"/><path d="M85 97v25M81 109h8" stroke="#d8be83" stroke-width="2"/></svg>`;
}

export function goodsIllustration(key = "grain") {
  const colors = {
    grain: "#c6ad6c",
    timber: "#99704c",
    ore: "#77756a",
    herbs: "#718367",
    spice: "#ad6542",
    silk: "#987787",
    iron: "#647777",
    provisions: "#b89764",
    medicine: "#6e8b80",
    fittings: "#9c845f",
    garments: "#6d8088",
    salt: "#d5cbb5",
    tea: "#7d8864",
    ceramics: "#ac775f",
    pearls: "#ded5c1",
    amber: "#c99548",
    wine: "#80504c",
    copper: "#ac7954",
    coal: "#595c54",
    glass: "#90a7a0",
    tools: "#8e978c",
  };
  const color = colors[key] || "#ad9874";
  const raw = [
    "ore",
    "iron",
    "copper",
    "coal",
    "amber",
    "salt",
    "pearls",
  ].includes(key);
  const bottle = ["wine", "medicine", "glass"].includes(key);
  const fabric = ["silk", "garments"].includes(key);
  let drawing;
  if (raw)
    drawing = `<path d="m25 59 9-28 22-8 19 15 10 22-30 10z" fill="${color}"/><path d="m34 31 22 16 19-9M56 47l-1 23M25 59l31-12 29 13" stroke="#edddb5" opacity=".6"/><path d="m73 64 13-16 12 11-4 14-15 4z" fill="${color}"/>`;
  else if (bottle)
    drawing = `<path d="M47 13h17v18q15 9 15 24v22H33V55q0-15 14-24z" fill="${color}"/><path d="M47 13h17v8H47z" fill="#9e8153"/><path d="M38 48h36v18H38z" fill="#e6d7b5"/><path d="M47 54h18M51 60h10" stroke="#8b7250"/><path d="M42 38q-6 8-5 17" stroke="#e9ead6" opacity=".6" stroke-width="3"/>`;
  else if (fabric)
    drawing = `<path d="M27 31q10-10 20-5l43 17v29L46 57q-18 0-19-14z" fill="${color}"/><ellipse cx="35" cy="36" rx="10" ry="14" fill="#c6ac98"/><ellipse cx="35" cy="36" rx="5" ry="8" fill="${color}"/><path d="m47 30 6 30M61 35l6 30M76 41l5 28" stroke="#d9c9b2"/><path d="m49 55 40 16-16 7-33-11" fill="${color}"/>`;
  else if (key === "timber")
    drawing = `<g fill="${color}"><path d="m19 47 50-30 15 10-49 31zM28 66l48-29 18 11-48 29z"/><ellipse cx="28" cy="54" rx="11" ry="9"/><ellipse cx="38" cy="72" rx="11" ry="9"/></g><g fill="none" stroke="#d8bb87"><ellipse cx="28" cy="54" rx="6" ry="5"/><ellipse cx="38" cy="72" rx="6" ry="5"/><path d="m47 31 8 40M69 21l8 36"/></g>`;
  else if (key === "ceramics")
    drawing = `<path d="M39 20h30l-3 15q20 13 14 32-5 13-27 12-24-1-25-15-3-18 14-29z" fill="${color}"/><path d="M36 48h40M32 58h48M39 22h29" stroke="#e6d3aa" stroke-width="2"/>`;
  else
    drawing = `<path d="m33 18 16 8 23-8-7 16q26 21 21 38-26 17-56 2-12-19 14-39z" fill="${color}"/><path d="M43 33h23M49 39q-13 20-11 28M61 39q15 16 12 30" fill="none" stroke="#e6d1a6" opacity=".6"/><path d="M41 55h29v14H41z" fill="#e4d5b6"/><path d="M50 60h12M54 56v10" stroke="#8c7451"/>`;
  return `<svg class="goods-art" viewBox="0 0 116 92" aria-hidden="true" focusable="false"><ellipse cx="59" cy="79" rx="43" ry="7" fill="#755634" opacity=".14"/><g stroke="#6d5940" stroke-width="1.5" stroke-linejoin="round">${drawing}</g></svg>`;
}

export function illustrationMarkup(kind, key) {
  if (kind === "vessel") return vesselIllustration(key);
  if (kind === "crew") return crewPortrait(key);
  if (kind === "goods") return goodsIllustration(key);
  return menuGlyph(kind);
}
