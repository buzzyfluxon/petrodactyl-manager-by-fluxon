const {
  ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, MessageFlags,
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
              "`>admin servers @user` — List a user's servers"
            ))
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (!target) return message.reply({ content: "Usage: `>admin <suspend|unsuspend|delete|servers> <@user or serverid>`" });

    const loading = await message.reply({ content: "Processing..." });

    try {

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