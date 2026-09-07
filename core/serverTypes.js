// © flux0n. All rights reserved.
const EGG_IDS = {
  nodejs: 15, node: 15, js: 15, bot: 15,
  python: 16, py: 16,
  vanilla: 1, forge: 2,
  bungeecord: 3, bungee: 3,
  paper: 5, mc: 5, minecraft: 5, java: 5,
  csgo: 6, ark: 7, tf2: 8, gmod: 11, rust: 14,
  mumble: 12, teamspeak: 13, ts3: 13,
};

function findEggId(type) {
  return EGG_IDS[String(type).toLowerCase()] ?? null;
}

module.exports = { EGG_IDS, findEggId };
