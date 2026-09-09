// © flux0n. All rights reserved.


const { EmbedBuilder } = require("discord.js");
const net = require("net");

const ACCENT = 0x9B7BFF;
const EMOJI_ONLINE = process.env.EMOJI_ONLINE || "<a:mr_online:1546220642439921765>";
const EMOJI_OFFLINE = process.env.EMOJI_OFFLINE || "<a:offline:1546221526028779621>";
const REQUEST_TIMEOUT = 5000;

const LAVALINK_HOST = process.env.LAVALINK_HOST || "node-1.deskhost.fun";
const LAVALINK_PORT = Number(process.env.LAVALINK_PORT || 20003);
const LAVALINK_PASSWORD = process.env.LAVALINK_PASSWORD || "deskhost";
const LAVALINK_SECURE = String(process.env.LAVALINK_SECURE || "false").toLowerCase() === "true";
const LAVALINK_IDENTIFIER = process.env.LAVALINK_IDENTIFIER || "desk-host-node-1";

function line(ok, label) {
  return `${ok ? EMOJI_ONLINE : EMOJI_OFFLINE}  **${label}**`;
}

function fmtLatency(ms) {
  return ms == null ? "n/a" : `${ms}ms`;
}

function checkLavalinkNode(host, port) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let settled = false;

    const finish = (ok) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch (_) {}
      resolve({ ok, latency: ok ? Date.now() - start : null });
    };

    socket.setTimeout(REQUEST_TIMEOUT);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));

    try {
      socket.connect(port, host);
    } catch (_) {
      finish(false);
    }
  });
}

async function buildEmbed(client) {
  const node = await checkLavalinkNode(LAVALINK_HOST, LAVALINK_PORT);

  return new EmbedBuilder()
    .setColor(ACCENT)
    .setTitle("Desk Host — Lavalink Node")
    .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: "Status", value: `${line(node.ok, node.ok ? "Online" : "Offline")}\n\`${fmtLatency(node.latency)}\``, inline: true },
      { name: "Identifier", value: `\`${LAVALINK_IDENTIFIER}\``, inline: true },
      { name: "Secure", value: `\`${LAVALINK_SECURE ? "Yes (wss)" : "No (ws)"}\``, inline: true },
      { name: "Host", value: `\`${LAVALINK_HOST}\``, inline: true },
      { name: "Port", value: `\`${LAVALINK_PORT}\``, inline: true },
      { name: "Password", value: `\`${LAVALINK_PASSWORD}\``, inline: true }
    )
    .setFooter({ text: "DESK HOST • Lavalink Node Info", iconURL: client.user.displayAvatarURL() })
    .setTimestamp();
}

module.exports = {
  name: "lavalink",

  async execute(message, args, client) {
    const sent = await message.channel.send({ content: "Checking Lavalink node..." });
    const embed = await buildEmbed(client);
    await sent.edit({ content: null, embeds: [embed] });
  },
};
