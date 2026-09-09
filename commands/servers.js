// © flux0n. All rights reserved.

const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require("discord.js");

const { PanelManager } = require("../core/panelManager");
const { DataBaseInterface } = require("../core/dataBaseInterface");
const { OwnerManager } = require("../core/ownerManager");
const { EGG_IDS } = require("../core/serverTypes");
const { getPlan } = require("../core/paidPlans");
const axios = require("axios");

const panel = new PanelManager(
  process.env.PTERODACTYL_API_URL,
  process.env.PTERODACTYL_API_KEY,
  process.env.PTERODACTYL_ACCOUNT_API_KEY
);
const db = new DataBaseInterface();
const ownerMgr = new OwnerManager();

const PURPLE = 0x7c3aed;
const RED = 0xe74c3c;

const API = () => process.env.PTERODACTYL_API_URL;
const KEY = () => process.env.PTERODACTYL_API_KEY;
const hdrs = () => ({ Authorization: `Bearer ${KEY()}`, Accept: "application/json", "Content-Type": "application/json" });

const PAGE_SIZE = 5;
const PAID_LIST_KEY = "paid_protection_list";
const COLLECTOR_TIME = 600000;
const MODAL_TIME = 120000;
const GRACE_DAYS = 7;
const GRACE_MS = GRACE_DAYS * 86400000;

const EMOJI_ALL = "<:modules:1546955115947233410>";
const EMOJI_NODEJS = "<:node_js:1546955010716475577>";
const EMOJI_PYTHON = "<:python:1546954962540691576>";
const EMOJI_LAVALINK = "<:Voice:1546955500518641684>";

const CATEGORIES = [
  { value: "all", label: "All Servers", emoji: EMOJI_ALL },
  { value: "paid", label: "Paid", emoji: "💎" },
  { value: "free", label: "Free", emoji: "🆓" },
  { value: "nodejs", label: "Node.js / JS", emoji: EMOJI_NODEJS },
  { value: "python", label: "Python", emoji: EMOJI_PYTHON },
  { value: "lavalink", label: "Lavalink", emoji: EMOJI_LAVALINK },
];

function deny(message) {
  return message.reply({
    components: [
      new ContainerBuilder()
        .setAccentColor(RED)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Access Denied"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("This command is restricted to bot owners."))
    ],
    flags: MessageFlags.IsComponentsV2,
  });
}

function errorContainer(err) {
  return new ContainerBuilder()
    .setAccentColor(RED)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Error"))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`\n${err.response?.status ?? ""} ${err.message}\n\`\`\``));
}

async function fetchAllServers() {
  const res = await axios.get(`${API()}/api/application/servers?per_page=10000&include=user`, { headers: hdrs() });
  return res.data.data.slice().sort((a, b) => a.attributes.id - b.attributes.id);
}

async function getNodeMap() {
  const map = {};
  try {
    const nodes = await panel.getPanelNodes();
    for (const n of nodes) map[n.attributes.id] = n.attributes.name;
  } catch (_) {}
  return map;
}

async function getEmailToDiscordMap() {
  const all = await db.fetchAll();
  const map = {};
  for (const entry of all) {
    const id = entry && entry.id;
    if (id && /^\d{17,19}$/.test(String(id)) && entry.value && entry.value.e_mail) {
      map[String(entry.value.e_mail).toLowerCase()] = String(id);
    }
  }
  return map;
}

async function getPaidMap() {
  const list = await db.getObject(PAID_LIST_KEY);
  const map = new Map();
  if (!Array.isArray(list)) return map;
  for (const entry of list) {
    map.set(entry.uuid, entry);
  }
  return map;
}

function typeLabel(a) {
  if (a.egg === EGG_IDS.nodejs) return "Node.js / JS";
  if (a.egg === EGG_IDS.python) return "Python";
  if (a.egg === EGG_IDS.lavalink) return "Lavalink";
  return `Egg #${a.egg}`;
}

function matchesCategory(a, category, paidMap) {
  switch (category) {
    case "paid": return paidMap.has(a.uuid);
    case "free": return !paidMap.has(a.uuid);
    case "nodejs": return a.egg === EGG_IDS.nodejs;
    case "python": return a.egg === EGG_IDS.python;
    case "lavalink": return a.egg === EGG_IDS.lavalink;
    default: return true;
  }
}

function matchesSearch(a, query, emailMap) {
  const q = query.toLowerCase();
  const ownerEmail = a.relationships?.user?.attributes?.email || "";
  const discordId = ownerEmail ? emailMap[ownerEmail.toLowerCase()] : null;
  return (
    a.name.toLowerCase().includes(q) ||
    a.identifier.toLowerCase().includes(q) ||
    a.uuid.toLowerCase().includes(q) ||
    String(a.id) === q ||
    ownerEmail.toLowerCase().includes(q) ||
    discordId === q
  );
}

function computeCounts(servers, paidMap) {
  const counts = { all: servers.length };
  for (const cat of CATEGORIES) {
    if (cat.value === "all") continue;
    counts[cat.value] = servers.filter((s) => matchesCategory(s.attributes, cat.value, paidMap)).length;
  }
  return counts;
}

function formatServerBlock(s, idx, emailMap, nodeMap, paidMap) {
  const a = s.attributes;
  const ownerEmail = a.relationships?.user?.attributes?.email || null;
  const discordId = ownerEmail ? emailMap[ownerEmail.toLowerCase()] : null;
  const ownerLine = discordId
    ? `<@${discordId}>  \`${ownerEmail}\``
    : ownerEmail
      ? `\`${ownerEmail}\` — no linked Discord account`
      : "Unknown";
  const nodeName = nodeMap[a.node] || `Node #${a.node}`;
  const limits = a.limits || {};

  const paidEntry = paidMap.get(a.uuid);
  const plan = paidEntry ? getPlan(paidEntry.plan) : null;
  const planLabel = plan ? plan.label : paidEntry?.plan;

  let tier = "Free";
  if (paidEntry) {
    const now = Date.now();
    if (now < paidEntry.protectedUntil) {
      tier = `Paid — ${planLabel}  \`until ${new Date(paidEntry.protectedUntil).toLocaleDateString()}\``;
    } else {
      const graceEnd = paidEntry.protectedUntil + GRACE_MS;
      const daysLeft = Math.max(0, Math.ceil((graceEnd - now) / 86400000));
      tier = `Paid — ${planLabel}  \`expired, grace ${daysLeft}d left\``;
    }
  }

  const panelLink = `${process.env.PTERODACTYL_API_URL}/server/${a.identifier}`;

  return (
    `**${idx}. ${a.name}**\n` +
    `> ID: \`${a.id}\`  •  Identifier: \`${a.identifier}\`  •  UUID: \`${a.uuid}\`\n` +
    `> Owner: ${ownerLine}\n` +
    `> Type: \`${typeLabel(a)}\`  •  Tier: ${tier}\n` +
    `> Node: \`${nodeName}\`  •  Status: \`${a.suspended ? "Suspended" : (a.status || "active")}\`\n` +
    `> RAM: \`${limits.memory ?? "?"}MB\`  Disk: \`${limits.disk ?? "?"}MB\`  CPU: \`${limits.cpu ?? "?"}%\`  Created: \`${new Date(a.created_at).toLocaleDateString()}\`\n` +
    `> Panel: ${panelLink}`
  );
}

function buildServersContainer(state) {
  const { filtered, page, totalPages, categoryValue, query, emailMap, nodeMap, paidMap, allCounts, disabled } = state;

  const start = page * PAGE_SIZE;
  const pageServers = filtered.slice(start, start + PAGE_SIZE);
  const body = pageServers.length
    ? pageServers.map((s, i) => formatServerBlock(s, start + i + 1, emailMap, nodeMap, paidMap)).join("\n\n")
    : "No servers match this filter.";

  const filterLabel = query
    ? `Search: "${query}"`
    : CATEGORIES.find((c) => c.value === categoryValue)?.label ?? "All Servers";

  const container = new ContainerBuilder()
    .setAccentColor(PURPLE)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Server Directory"))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `-# \`${filtered.length}\` result${filtered.length !== 1 ? "s" : ""}  •  Filter: **${filterLabel}**  •  Page \`${page + 1}/${totalPages}\`  •  \`${allCounts.all}\` total on panel`
    ))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("servers_category_select")
        .setPlaceholder("Filter by category")
        .setDisabled(disabled)
        .addOptions(
          CATEGORIES.map((cat) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(cat.label)
              .setValue(cat.value)
              .setEmoji(cat.emoji)
              .setDescription(`${allCounts[cat.value]} server${allCounts[cat.value] !== 1 ? "s" : ""}`)
              .setDefault(!query && categoryValue === cat.value)
          )
        )
    )
  );

  const buttons = [
    new ButtonBuilder().setCustomId("servers_prev").setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(disabled || page === 0),
    new ButtonBuilder().setCustomId("servers_next").setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(disabled || page >= totalPages - 1),
    new ButtonBuilder().setCustomId("servers_search").setLabel("Search").setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId("servers_refresh").setLabel("Refresh").setStyle(ButtonStyle.Secondary).setDisabled(disabled),
  ];

  if (query) {
    buttons.push(
      new ButtonBuilder().setCustomId("servers_clear_search").setLabel("Clear Search").setStyle(ButtonStyle.Danger).setDisabled(disabled)
    );
  }

  container.addActionRowComponents(new ActionRowBuilder().addComponents(buttons));

  return container;
}

module.exports = {
  name: "servers",

  async execute(message) {
    if (!(await ownerMgr.isOwner(message.author.id))) return deny(message);

    const loading = await message.reply({ content: "Fetching every server on the panel..." });

    let servers, nodeMap, emailMap, paidMap;
    try {
      [servers, nodeMap, emailMap, paidMap] = await Promise.all([
        fetchAllServers(),
        getNodeMap(),
        getEmailToDiscordMap(),
        getPaidMap(),
      ]);
    } catch (err) {
      return loading.edit({ content: null, components: [errorContainer(err)], flags: MessageFlags.IsComponentsV2 });
    }

    let allCounts = computeCounts(servers, paidMap);
    let categoryValue = "all";
    let query = null;
    let page = 0;

    function currentFiltered() {
      if (query) return servers.filter((s) => matchesSearch(s.attributes, query, emailMap));
      return servers.filter((s) => matchesCategory(s.attributes, categoryValue, paidMap));
    }

    function render(disabled = false) {
      const filtered = currentFiltered();
      const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      page = Math.min(page, totalPages - 1);
      return buildServersContainer({
        filtered, page, totalPages, categoryValue, query,
        emailMap, nodeMap, paidMap, allCounts, disabled,
      });
    }

    const sentMsg = await loading.edit({
      content: null,
      components: [render()],
      flags: MessageFlags.IsComponentsV2,
    });

    const collector = sentMsg.createMessageComponentCollector({
      filter: (i) => i.user.id === message.author.id,
      time: COLLECTOR_TIME,
    });

    collector.on("collect", async (interaction) => {
      try {
        if (interaction.customId === "servers_prev") {
          page = Math.max(0, page - 1);
          return await interaction.update({ components: [render()], flags: MessageFlags.IsComponentsV2 });
        }

        if (interaction.customId === "servers_next") {
          page += 1;
          return await interaction.update({ components: [render()], flags: MessageFlags.IsComponentsV2 });
        }

        if (interaction.customId === "servers_category_select") {
          categoryValue = interaction.values[0];
          query = null;
          page = 0;
          return await interaction.update({ components: [render()], flags: MessageFlags.IsComponentsV2 });
        }

        if (interaction.customId === "servers_clear_search") {
          query = null;
          page = 0;
          return await interaction.update({ components: [render()], flags: MessageFlags.IsComponentsV2 });
        }

        if (interaction.customId === "servers_refresh") {
          await interaction.deferUpdate();
          try {
            servers = await fetchAllServers();
            [nodeMap, emailMap, paidMap] = await Promise.all([getNodeMap(), getEmailToDiscordMap(), getPaidMap()]);
            allCounts = computeCounts(servers, paidMap);
          } catch (err) {
            return await interaction.editReply({ components: [errorContainer(err)], flags: MessageFlags.IsComponentsV2 });
          }
          return await interaction.editReply({ components: [render()], flags: MessageFlags.IsComponentsV2 });
        }

        if (interaction.customId === "servers_search") {
          const modal = new ModalBuilder()
            .setCustomId("servers_search_modal")
            .setTitle("Search Servers")
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId("servers_search_query")
                  .setLabel("Name, identifier, UUID, ID, email or Discord ID")
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
                  .setMaxLength(100)
              )
            );

          await interaction.showModal(modal);

          try {
            const submitted = await interaction.awaitModalSubmit({
              time: MODAL_TIME,
              filter: (i) => i.user.id === message.author.id && i.customId === "servers_search_modal",
            });

            query = submitted.fields.getTextInputValue("servers_search_query").trim();
            page = 0;
            await submitted.update({ components: [render()], flags: MessageFlags.IsComponentsV2 });
          } catch (_) {}
        }
      } catch (err) {
        console.error("[servers] Interaction failed:", err);
      }
    });

    collector.on("end", async () => {
      try {
        await sentMsg.edit({ components: [render(true)], flags: MessageFlags.IsComponentsV2 });
      } catch (_) {}
    });
  }
};
