// © flux0n. All rights reserved.
﻿

const { EmbedBuilder } = require("discord.js");
const axios = require("axios");
const { DataBaseInterface } = require("../core/dataBaseInterface");

const db = new DataBaseInterface();

const ACCENT = 0x9B7BFF;
const EMOJI_ONLINE = process.env.EMOJI_ONLINE || "<a:mr_online:1546220642439921765>";
const EMOJI_OFFLINE = process.env.EMOJI_OFFLINE || "<a:offline:1546221526028779621>";
const STATUS_IMAGE = "https://cdn.discordapp.com/attachments/1545778558389985403/1546218672643772466/content.png";
const REQUEST_TIMEOUT = 5000;
const REFRESH_INTERVAL = 30000;
const ACTIVE_MESSAGES_KEY = "active_status_messages";

async function getActiveMessages() {
  const data = await db.getObject(ACTIVE_MESSAGES_KEY);
  return Array.isArray(data) ? data : [];
}

async function addActiveMessage(channelId, messageId) {
  const list = await getActiveMessages();
  list.push({ channelId, messageId });
  await db.setObject(ACTIVE_MESSAGES_KEY, list);
}

async function removeActiveMessage(messageId) {
  const list = await getActiveMessages();
  await db.setObject(ACTIVE_MESSAGES_KEY, list.filter((m) => m.messageId !== messageId));
}

function startRefreshLoop(client, sentMessage) {
  const interval = setInterval(async () => {
    try {
      const updated = await buildEmbed(client);
      await sentMessage.edit({ embeds: [updated] });
    } catch (_) {
      clearInterval(interval);
      await removeActiveMessage(sentMessage.id);
    }
  }, REFRESH_INTERVAL);
}

function line(ok, label) {
  return `${ok ? EMOJI_ONLINE : EMOJI_OFFLINE}  **${label}**`;
}

function checkBot(client) {
  const ping = Math.round(client.ws.ping);
  if (Number.isFinite(ping) && ping >= 0) return { ok: true, latency: ping };
  return { ok: true, latency: null };
}

async function checkPanel() {
  const base = process.env.PTERODACTYL_API_URL;
  const start = Date.now();
  try {
    const res = await axios.head(`${base}/auth/login`, {
      timeout: REQUEST_TIMEOUT,
      validateStatus: () => true,
    });
    const latency = Date.now() - start;
    return { ok: res.status > 0 && res.status < 500, latency };
  } catch (_) {
    return { ok: false, latency: null };
  }
}

async function checkApi() {
  const base = process.env.PTERODACTYL_API_URL;
  const key = process.env.PTERODACTYL_API_KEY;
  const start = Date.now();
  try {
    const res = await axios.get(`${base}/api/application/nodes?per_page=1`, {
      timeout: REQUEST_TIMEOUT,
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      validateStatus: () => true,
    });
    const latency = Date.now() - start;
    return { ok: res.status >= 200 && res.status < 300, latency, nodesPayload: res.data };
  } catch (_) {
    return { ok: false, latency: null, nodesPayload: null };
  }
}

async function checkNodes(nodesPayload) {
  let nodes = [];
  try {
    nodes = nodesPayload?.data || [];
  } catch (_) {}

  if (!nodes.length) return { ok: false, latency: null, online: 0, total: 0 };

  const results = await Promise.all(
    nodes.map(async (n) => {
      const a = n.attributes;
      const scheme = a.scheme || "https";
      const url = `${scheme}://${a.fqdn}:${a.daemon_listen}/api/system`;
      const start = Date.now();
      try {
        const res = await axios.head(url, {
          timeout: REQUEST_TIMEOUT,
          validateStatus: () => true,
        });
        return { ok: res.status > 0, latency: Date.now() - start };
      } catch (_) {
        return { ok: false, latency: null };
      }
    })
  );

  const online = results.filter((r) => r.ok).length;
  const measured = results.filter((r) => r.ok && r.latency != null);
  const avgLatency = measured.length
    ? Math.round(measured.reduce((sum, r) => sum + r.latency, 0) / measured.length)
    : null;

  return { ok: online === results.length && results.length > 0, latency: avgLatency, online, total: results.length };
}

async function checkDatabase() {
  const start = Date.now();
  try {
    await db.fetchAll();
    return { ok: true, latency: Date.now() - start };
  } catch (_) {
    return { ok: false, latency: null };
  }
}

function fmtLatency(ms) {
  return ms == null ? "n/a" : `${ms}ms`;
}

async function buildEmbed(client) {
  const [bot, panel, api, database] = await Promise.all([
    Promise.resolve(checkBot(client)),
    checkPanel(),
    checkApi(),
    checkDatabase(),
  ]);

  const nodes = await checkNodes(api.nodesPayload);

  return new EmbedBuilder()
    .setColor(ACCENT)
    .setTitle("Desk Host — Status")
    .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
    .setImage(STATUS_IMAGE)
    .addFields(
      { name: "Bot", value: `${line(bot.ok, bot.ok ? "Online" : "Offline")}\n\`${fmtLatency(bot.latency)}\``, inline: true },
      { name: "Panel", value: `${line(panel.ok, panel.ok ? "Online" : "Offline")}\n\`${fmtLatency(panel.latency)}\``, inline: true },
      { name: "API", value: `${line(api.ok, api.ok ? "Online" : "Offline")}\n\`${fmtLatency(api.latency)}\``, inline: true },
      {
        name: "Nodes",
        value: `${line(nodes.ok, nodes.total ? `${nodes.online}/${nodes.total} Online` : "Unavailable")}\n\`${fmtLatency(nodes.latency)}\``,
        inline: true,
      },
      { name: "Database", value: `${line(database.ok, database.ok ? "Online" : "Offline")}\n\`${fmtLatency(database.latency)}\``, inline: true }
    )
    .setFooter({ text: "DESK HOST • Live Service Status", iconURL: client.user.displayAvatarURL() })
    .setTimestamp();
}

module.exports = {
  name: "status",

  async execute(message, args, client) {
    const sent = await message.channel.send({ content: "Checking Desk Host infrastructure..." });
    const embed = await buildEmbed(client);
    await sent.edit({ content: null, embeds: [embed] });

    await addActiveMessage(sent.channel.id, sent.id);
    startRefreshLoop(client, sent);
  },

  async resumeAll(client) {
    const list = await getActiveMessages();
    for (const { channelId, messageId } of list) {
      try {
        const channel = await client.channels.fetch(channelId);
        const sentMessage = await channel.messages.fetch(messageId);
        startRefreshLoop(client, sentMessage);
      } catch (_) {
        await removeActiveMessage(messageId);
      }
    }
  },
};
