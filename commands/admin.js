const {
  ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, MessageFlags,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require("discord.js");

const { PanelManager } = require("../core/panelManager");
const { DataBaseInterface } = require("../core/dataBaseInterface");
const { OwnerManager } = require("../core/ownerManager");
const { notifyServerDeleted } = require("../core/deletionNotifier");
const axios = require("axios");

const panel   = new PanelManager(
  process.env.PTERODACTYL_API_URL,
  process.env.PTERODACTYL_API_KEY,
  process.env.PTERODACTYL_ACCOUNT_API_KEY
);
const db      = new DataBaseInterface();
const ownerMgr = new OwnerManager();
const PURPLE  = 0x7c3aed;

const API  = () => process.env.PTERODACTYL_API_URL;
const KEY  = () => process.env.PTERODACTYL_API_KEY;
const hdrs = () => ({ Authorization: `Bearer ${KEY()}`, Accept: "application/json", "Content-Type": "application/json" });

const ACTIVITY_KEY = "auto_cleanup_activity";

async function markActivity(uuid, patch) {
  if (!uuid) return;
  const activity = (await db.getObject(ACTIVITY_KEY)) || {};
  activity[uuid] = { ...(activity[uuid] || {}), ...patch };
  await db.setObject(ACTIVITY_KEY, activity);
}

function c(title, body, color = PURPLE) {
  return new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${title}`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
}

function deny(message) {
  return message.reply({
    components: [c("Access Denied", "This command is restricted to bot owners.")],
    flags: MessageFlags.IsComponentsV2,
  });
}

async function resolveTarget(target) {

  const discordId = target.replace(/[<@!>]/g, "");

  if (/^\d{17,19}$/.test(discordId)) {

    const userData = await db.getObject(discordId);
    if (!userData) return { type: "user", error: `No panel account found for <@${discordId}>.` };
    const servers = await panel.getAllServers(userData.e_mail);
    return { type: "user", email: userData.e_mail, servers: servers || [], discordId };
  }

  return { type: "server", identifier: target };
}

async function getServerByIdentifier(identifier) {
  const res = await axios.get(`${API()}/api/application/servers?per_page=10000`, { headers: hdrs() });
  return res.data.data.find(s => s.attributes.identifier === identifier) || null;
}

const ALLSERVERS_PAGE_SIZE = 5;

async function getAllPanelServersDetailed() {
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

function formatServerBlock(s, idx, emailMap, nodeMap) {
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

  return (
    `**${idx}. ${a.name}**\n` +
    `> Server ID: \`${a.id}\`  •  Identifier: \`${a.identifier}\`\n` +
    `> UUID: \`${a.uuid}\`\n` +
    `> Owner: ${ownerLine}\n` +
    `> Node: \`${nodeName}\`  •  Status: \`${a.suspended ? "Suspended" : (a.status || "active")}\`\n` +
    `> RAM: \`${limits.memory ?? "?"}MB\`  Disk: \`${limits.disk ?? "?"}MB\`  CPU: \`${limits.cpu ?? "?"}%\`  Swap: \`${limits.swap ?? "?"}MB\`\n` +
    `> Databases: \`${a.feature_limits?.databases ?? 0}\`  Backups: \`${a.feature_limits?.backups ?? 0}\`  Created: \`${new Date(a.created_at).toLocaleDateString()}\``
  );
}

function buildAllServersPage(servers, page, totalPages, emailMap, nodeMap, msgId, disabled = false) {
  const start = page * ALLSERVERS_PAGE_SIZE;
  const pageServers = servers.slice(start, start + ALLSERVERS_PAGE_SIZE);
  const body = pageServers
    .map((s, i) => formatServerBlock(s, start + i + 1, emailMap, nodeMap))
    .join("\n\n");

  const container = new ContainerBuilder()
    .setAccentColor(PURPLE)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("# All Servers"))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# \`${servers.length}\` total  •  Page \`${page + 1}/${totalPages}\``))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body || "No servers found on the panel."));

  if (totalPages > 1) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`allsrv_prev_${msgId}`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(disabled || page === 0),
        new ButtonBuilder().setCustomId(`allsrv_next_${msgId}`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(disabled || page >= totalPages - 1)
      )
    );
  }

  return container;
}

async function suspendServer(numericId, uuid) {
  await axios.post(`${API()}/api/application/servers/${numericId}/suspend`, {}, { headers: hdrs() });
  await markActivity(uuid, { suspendedAt: Date.now() });
}

async function unsuspendServer(numericId, uuid) {
  await axios.post(`${API()}/api/application/servers/${numericId}/unsuspend`, {}, { headers: hdrs() });
  await markActivity(uuid, { lastOnline: Date.now(), suspendedAt: null });
}

async function deleteServer(numericId) {
  await axios.delete(`${API()}/api/application/servers/${numericId}`, { headers: hdrs() });
}

module.exports = {
  name: "admin",

  async execute(message, args) {
    if (!(await ownerMgr.isOwner(message.author.id))) return deny(message);

    const sub    = args[0];
    const target = args[1];

    if (!sub) {
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(PURPLE)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Admin Commands"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
              "`>admin suspend @user` — Suspend all servers of a user\n" +
              "`>admin suspend <id>` — Suspend a server by ID\n" +
              "`>admin unsuspend @user` — Unsuspend all servers of a user\n" +
              "`>admin unsuspend <id>` — Unsuspend a server by ID\n" +
              "`>admin delete @user` — Delete all servers of a user\n" +
              "`>admin delete <id>` — Delete a server by ID\n" +
              "`>admin servers @user` — List a user's servers\n" +
              "`>admin allservers` — List every server on the panel with full details"
            ))
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub !== "allservers" && !target) {
      return message.reply({ content: "Usage: `>admin <suspend|unsuspend|delete|servers> <@user or serverid>`" });
    }

    const loading = await message.reply({ content: sub === "allservers" ? "Fetching every server on the panel..." : "Processing..." });

    try {

      if (sub === "allservers") {
        let servers, nodeMap, emailMap;
        try {
          [servers, nodeMap, emailMap] = await Promise.all([
            getAllPanelServersDetailed(),
            getNodeMap(),
            getEmailToDiscordMap(),
          ]);
        } catch (err) {
          return loading.edit({
            content: null,
            components: [c("Error", `\`\`\`\n${err.response?.status ?? ""} ${err.message}\n\`\`\``)],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        const totalPages = Math.max(1, Math.ceil(servers.length / ALLSERVERS_PAGE_SIZE));
        let page = 0;

        const sentMsg = await loading.edit({
          content: null,
          components: [buildAllServersPage(servers, page, totalPages, emailMap, nodeMap, loading.id)],
          flags: MessageFlags.IsComponentsV2,
        });

        if (totalPages <= 1) return;

        const collector = sentMsg.createMessageComponentCollector({
          filter: (i) => i.user.id === message.author.id,
          time: 300000,
        });

        collector.on("collect", async (interaction) => {
          if (interaction.customId === `allsrv_prev_${loading.id}`) page = Math.max(0, page - 1);
          else if (interaction.customId === `allsrv_next_${loading.id}`) page = Math.min(totalPages - 1, page + 1);
          else return;

          await interaction.update({
            components: [buildAllServersPage(servers, page, totalPages, emailMap, nodeMap, loading.id)],
            flags: MessageFlags.IsComponentsV2,
          });
        });

        collector.on("end", async () => {
          try {
            await sentMsg.edit({
              components: [buildAllServersPage(servers, page, totalPages, emailMap, nodeMap, loading.id, true)],
              flags: MessageFlags.IsComponentsV2,
            });
          } catch (_) {}
        });

        return;
      }

      if (sub === "servers") {
        const r = await resolveTarget(target);
        if (r.error) return loading.edit({ content: null, components: [c("Not Found", r.error)], flags: MessageFlags.IsComponentsV2 });
        if (r.type !== "user") return loading.edit({ content: "Usage: `>admin servers @user`" });

        if (!r.servers.length) {
          return loading.edit({
            content: null,
            components: [c("No Servers", `<@${r.discordId}> has no servers on the panel.`)],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        const lines = r.servers.map((s, i) =>
          `**${i + 1}.** \`${s.attributes.name}\`  ID: \`${s.attributes.identifier}\`  Status: \`${s.attributes.status || "active"}\``
        ).join("\n");

        return loading.edit({
          content: null,
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent("# User Servers"))
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# <@${r.discordId}>  •  ${r.email}`))
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines))
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (sub === "suspend") {
        const r = await resolveTarget(target);
        if (r.error) return loading.edit({ content: null, components: [c("Not Found", r.error)], flags: MessageFlags.IsComponentsV2 });

        if (r.type === "user") {
          if (!r.servers.length) {
            return loading.edit({ content: null, components: [c("No Servers", `<@${r.discordId}> has no servers.`)], flags: MessageFlags.IsComponentsV2 });
          }
          const results = [];
          for (const s of r.servers) {
            try {
              await suspendServer(s.attributes.id, s.attributes.uuid);
              results.push(`\`${s.attributes.name}\` — suspended`);
            } catch (e) {
              results.push(`\`${s.attributes.name}\` — failed: ${e.response?.status ?? e.message}`);
            }
          }
          return loading.edit({
            content: null,
            components: [
              new ContainerBuilder()
                .setAccentColor(PURPLE)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Servers Suspended"))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# <@${r.discordId}>  •  ${r.servers.length} server${r.servers.length !== 1 ? "s" : ""}`))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(results.join("\n")))
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        const srv = await getServerByIdentifier(r.identifier);
        if (!srv) return loading.edit({ content: null, components: [c("Not Found", `No server found with ID \`${r.identifier}\`.`)], flags: MessageFlags.IsComponentsV2 });
        await suspendServer(srv.attributes.id, srv.attributes.uuid);
        return loading.edit({
          content: null,
          components: [c("Server Suspended", `\`${srv.attributes.name}\`  \`${r.identifier}\` has been suspended.`)],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (sub === "unsuspend") {
        const r = await resolveTarget(target);
        if (r.error) return loading.edit({ content: null, components: [c("Not Found", r.error)], flags: MessageFlags.IsComponentsV2 });

        if (r.type === "user") {
          if (!r.servers.length) {
            return loading.edit({ content: null, components: [c("No Servers", `<@${r.discordId}> has no servers.`)], flags: MessageFlags.IsComponentsV2 });
          }
          const results = [];
          for (const s of r.servers) {
            try {
              await unsuspendServer(s.attributes.id, s.attributes.uuid);
              results.push(`\`${s.attributes.name}\` — unsuspended`);
            } catch (e) {
              results.push(`\`${s.attributes.name}\` — failed: ${e.response?.status ?? e.message}`);
            }
          }
          return loading.edit({
            content: null,
            components: [
              new ContainerBuilder()
                .setAccentColor(PURPLE)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Servers Unsuspended"))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# <@${r.discordId}>  •  ${r.servers.length} server${r.servers.length !== 1 ? "s" : ""}`))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(results.join("\n")))
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        const srv = await getServerByIdentifier(r.identifier);
        if (!srv) return loading.edit({ content: null, components: [c("Not Found", `No server found with ID \`${r.identifier}\`.`)], flags: MessageFlags.IsComponentsV2 });
        await unsuspendServer(srv.attributes.id, srv.attributes.uuid);
        return loading.edit({
          content: null,
          components: [c("Server Unsuspended", `\`${srv.attributes.name}\`  \`${r.identifier}\` has been unsuspended.`)],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (sub === "delete") {
        const r = await resolveTarget(target);
        if (r.error) return loading.edit({ content: null, components: [c("Not Found", r.error)], flags: MessageFlags.IsComponentsV2 });

        if (r.type === "user") {
          if (!r.servers.length) {
            return loading.edit({ content: null, components: [c("No Servers", `<@${r.discordId}> has no servers.`)], flags: MessageFlags.IsComponentsV2 });
          }
          const results = [];
          for (const s of r.servers) {
            try {
              await deleteServer(s.attributes.id);
              results.push(`\`${s.attributes.name}\` — deleted`);
              await notifyServerDeleted(message.client, {
                userId: r.discordId,
                serverName: s.attributes.name,
                identifier: s.attributes.identifier,
                reason: `Deleted by an admin (<@${message.author.id}>)`,
              });
            } catch (e) {
              results.push(`\`${s.attributes.name}\` — failed: ${e.response?.status ?? e.message}`);
            }
          }
          return loading.edit({
            content: null,
            components: [
              new ContainerBuilder()
                .setAccentColor(PURPLE)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Servers Deleted"))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# <@${r.discordId}>  •  ${r.servers.length} server${r.servers.length !== 1 ? "s" : ""} permanently removed`))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(results.join("\n")))
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        const srv = await getServerByIdentifier(r.identifier);
        if (!srv) return loading.edit({ content: null, components: [c("Not Found", `No server found with ID \`${r.identifier}\`.`)], flags: MessageFlags.IsComponentsV2 });
        await deleteServer(srv.attributes.id);
        const ownerUserId = await panel.getUserIDfromUUID(srv.attributes.uuid).catch(() => null);
        await notifyServerDeleted(message.client, {
          userId: ownerUserId,
          serverName: srv.attributes.name,
          identifier: r.identifier,
          reason: `Deleted by an admin (<@${message.author.id}>)`,
        });
        return loading.edit({
          content: null,
          components: [c("Server Deleted", `\`${srv.attributes.name}\`  \`${r.identifier}\` has been permanently deleted.`)],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      return loading.edit({ content: `Unknown subcommand \`${sub}\`. Run \`>admin\` for help.`, components: [], flags: 0 });

    } catch (err) {
      console.error("[admin] Error:", err);
      return loading.edit({
        content: null,
        components: [c("Error", `\`\`\`\n${err.message}\n\`\`\``)],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  }
};
