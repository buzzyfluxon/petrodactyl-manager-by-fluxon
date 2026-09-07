// © flux0n. All rights reserved.
﻿

const {
  ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, MessageFlags,
} = require("discord.js");

const { OwnerManager } = require("../core/ownerManager");
const { DataBaseInterface } = require("../core/dataBaseInterface");
const axios = require("axios");

const ownerMgr = new OwnerManager();
const db = new DataBaseInterface();
const PURPLE = 0x7c3aed;

const cache = new Map();
const CACHE_TTL = 60_000;

function fmt(mb) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function bar(used, total, len = 14) {
  if (total === 0) return "N/A";
  const pct = Math.min(used / total, 1);
  const filled = Math.round(pct * len);
  return "█".repeat(filled) + "░".repeat(len - filled) + `  ${Math.round(pct * 100)}%`;
}

function dropdown(currentPage) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("stats_category_select")
      .setPlaceholder("Switch view...")
      .addOptions(
        { label: "Overview",  value: "overview",  description: "Users, servers, owners" },
        { label: "Resources", value: "resources", description: "RAM and disk usage" },
        { label: "Nodes",     value: "nodes",     description: "Per-node breakdown" }
      )
  );
}

function buildStatsContainer(page, statsData) {
  const {
    totalPanelUsers, botUsers, totalServers,
    owners, nodes, usedRam, totalRam,
    usedDisk, totalDisk, nodeLines, timestamp
  } = statsData;

  const ramFree = totalRam - usedRam;
  const diskFree = totalDisk - usedDisk;

  const container = new ContainerBuilder().setAccentColor(PURPLE);

  container
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("# Panel Statistics")
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# ${process.env.PTERODACTYL_API_URL}  •  ${timestamp} UTC`
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(2));

  if (page === "overview") {
    container
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("**Overview**")
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `Panel Users     \`${totalPanelUsers}\`\n` +
          `Bot Users       \`${botUsers}\`\n` +
          `Total Servers   \`${totalServers}\`\n` +
          `Bot Owners      \`${owners.length}\`\n` +
          `Nodes Online    \`${nodes.length}\``
        )
      );
  }

  if (page === "resources") {
    container
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("**Resource Usage**")
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `RAM Used    \`${fmt(usedRam)} / ${fmt(totalRam)}\`\n` +
          `\`${bar(usedRam, totalRam)}\`\n\n` +
          `Disk Used   \`${fmt(usedDisk)} / ${fmt(totalDisk)}\`\n` +
          `\`${bar(usedDisk, totalDisk)}\`\n\n` +
          `RAM Free    \`${fmt(ramFree)}\`\n` +
          `Disk Free   \`${fmt(diskFree)}\``
        )
      );
  }

  if (page === "nodes") {
    container
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("**Node Breakdown**")
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(nodeLines.join("\n\n") || "No nodes found.")
      );
  }

  container
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# Select a view below to switch.")
    )
    .addActionRowComponents(dropdown(page));

  return container;
}

async function fetchStatsData() {
  const apiBase = process.env.PTERODACTYL_API_URL;
  const apiKey  = process.env.PTERODACTYL_API_KEY;
  const headers = { Authorization: `Bearer ${apiKey}`, Accept: "application/json" };

  const [usersRes, serversRes, nodesRes] = await Promise.all([
    axios.get(`${apiBase}/api/application/users?per_page=10000`, { headers }),
    axios.get(`${apiBase}/api/application/servers?per_page=10000`, { headers }),
    axios.get(`${apiBase}/api/application/nodes?per_page=10000&include=servers`, { headers }),
  ]);

  const totalPanelUsers = usersRes.data.meta.pagination.total;
  const totalServers    = serversRes.data.meta.pagination.total;
  const nodes           = nodesRes.data.data;

  const allDbEntries = await db.fetchAll();
  const botUsers = allDbEntries.filter(e => e && e.id && String(e.id).length === 18).length;
  const owners   = await ownerMgr.getOwners();

  let totalRam = 0, usedRam = 0;
  let totalDisk = 0, usedDisk = 0;
  const nodeLines = [];

  for (const node of nodes) {
    const a    = node.attributes;
    const srvs = a.relationships.servers.data;

    let nUsedRam = 0, nUsedDisk = 0;
    for (const s of srvs) {
      nUsedRam  += s.attributes.limits.memory;
      nUsedDisk += s.attributes.limits.disk;
    }

    let freeAlloc = 0;
    try {
      const allocRes = await axios.get(
        `${apiBase}/api/application/nodes/${a.id}/allocations?per_page=10000`,
        { headers }
      );
      freeAlloc = allocRes.data.data.filter(al => !al.attributes.assigned).length;
    } catch (_) {}

    totalRam  += a.memory;
    usedRam   += nUsedRam;
    totalDisk += a.disk;
    usedDisk  += nUsedDisk;

    nodeLines.push(
      `**${a.name}**  \`${a.fqdn}\`\n` +
      `RAM    \`${fmt(nUsedRam)} / ${fmt(a.memory)}\`\n` +
      `Disk   \`${fmt(nUsedDisk)} / ${fmt(a.disk)}\`\n` +
      `Servers  \`${srvs.length}\`   Free Ports  \`${freeAlloc}\``
    );
  }

  return {
    totalPanelUsers, botUsers, totalServers, owners, nodes,
    usedRam, totalRam, usedDisk, totalDisk, nodeLines,
    timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
  };
}

module.exports = {
  name: "stats",
  buildStatsContainer,
  fetchStatsData,

  async execute(message) {
    if (!(await ownerMgr.isOwner(message.author.id))) {
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(PURPLE)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("# Access Denied")
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("Panel statistics are restricted to bot owners.")
            )
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const loading = await message.reply({ content: "Fetching panel statistics..." });

    try {
      const statsData = await fetchStatsData();

      cache.set(message.author.id, { data: statsData, ts: Date.now() });

      await loading.edit({
        content: null,
        components: [buildStatsContainer("overview", statsData)],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (err) {
      console.error("[stats] Error:", err);
      await loading.edit({
        content: null,
        components: [
          new ContainerBuilder()
            .setAccentColor(PURPLE)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("# Stats Fetch Failed")
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`\`\`\`\n${err.message}\n\`\`\``)
            )
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },

  cache,
};
