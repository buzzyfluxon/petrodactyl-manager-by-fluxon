// © flux0n. All rights reserved.
﻿

const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SectionBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const { PanelManager } = require("../core/panelManager");
const { DataBaseInterface } = require("../core/dataBaseInterface");
const { WebhookLogger } = require("../core/webhookLogger");
const { findEggId } = require("../core/serverTypes");
const { notifyServerDeleted } = require("../core/deletionNotifier");
const { OwnerManager } = require("../core/ownerManager");
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
const GREEN = 0x2ecc71;

const PURGE_CODEWORD = process.env.PURGE_CODEWORD || "SAFE";
const WHITELIST_KEY = "purge_whitelist";

const API = () => process.env.PTERODACTYL_API_URL;
const KEY = () => process.env.PTERODACTYL_API_KEY;
const hdrs = () => ({ Authorization: `Bearer ${KEY()}`, Accept: "application/json", "Content-Type": "application/json" });

function isProtectedName(name) {
  return String(name).toUpperCase().includes(PURGE_CODEWORD.toUpperCase());
}

async function getWhitelist() {
  const list = await db.getObject(WHITELIST_KEY);
  return Array.isArray(list) ? list : [];
}

const PAID_LIST_KEY = "paid_protection_list";

async function getActivePaidUuids() {
  const list = await db.getObject(PAID_LIST_KEY);
  if (!Array.isArray(list)) return new Set();
  const now = Date.now();
  return new Set(list.filter((e) => now < e.protectedUntil).map((e) => e.uuid));
}

async function setWhitelist(list) {
  return await db.setObject(WHITELIST_KEY, list);
}

async function getAllPanelServers() {
  const res = await axios.get(`${API()}/api/application/servers?per_page=10000&include=user`, { headers: hdrs() });
  return res.data.data;
}

const FREE_LIMITS = {
  memory: 256, swap: 0, disk: 512,
  io: 500, cpu: 50,
  databases: 0, backups: 0,
};

const ALLOWED_TYPES = ["nodejs", "node", "js", "bot", "python", "py"];
const MAX_SLOTS_PER_USER = 1;

function noAccountContainer() {
  return new ContainerBuilder()
    .setAccentColor(PURPLE)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("# No Panel Account")
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "You need a panel account before creating servers.\nRun `>user new` to get started."
      )
    );
}

module.exports = {
  name: "server",

  async execute(message, args, client) {
    const subcommand = args[0];
    const userId = message.author.id;

    if (!subcommand || subcommand === "help") {
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(PURPLE)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("# Server Commands")
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "`>server create <type> [name]` — Create a new server\n" +
                "`>server list` — List your servers\n" +
                "`>server delete <name>` — Delete a server by name\n" +
                "`>server protect` — Protect your servers from a purge\n" +
                "`>server types` — Show all supported types"
              )
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "**Free Tier**\n" +
                `\`RAM 256 MB\`  \`Disk 512 MiB\`  \`CPU 50%\`  \`Slots ${MAX_SLOTS_PER_USER}\`\n` +
                "-# Discord bot & Python servers only."
              )
            )
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (subcommand === "types") {
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(PURPLE)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("# Available Server Types")
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "**Discord / Bots**\n`nodejs`  `node`  `js`  `bot`\n\n" +
                "**Python**\n`python`  `py`\n\n" +
                "-# Only Discord bot and Python servers can be created via `>server create`."
              )
            )
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (subcommand === "whitelist") {
      if (!(await ownerMgr.isOwner(userId))) {
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

      const action = args[1];
      const target = args[2];

      if (action === "list") {
        const list = await getWhitelist();
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Purge Whitelist"))
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                list.length ? list.map((id, i) => `**${i + 1}.** \`${id}\``).join("\n") : "The whitelist is empty."
              ))
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if ((action === "add" || action === "remove") && target) {
        const list = await getWhitelist();

        if (action === "add") {
          if (list.includes(target)) {
            return message.reply({ content: `\`${target}\` is already whitelisted.` });
          }
          list.push(target);
          await setWhitelist(list);
          return message.reply({
            components: [
              new ContainerBuilder()
                .setAccentColor(GREEN)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Added To Whitelist"))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`${target}\` will never be purged.`))
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        if (!list.includes(target)) {
          return message.reply({ content: `\`${target}\` is not on the whitelist.` });
        }
        await setWhitelist(list.filter((id) => id !== target));
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Removed From Whitelist"))
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`${target}\` can be purged again.`))
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      return message.reply({
        content: "Usage: `>server whitelist add <server-id>` · `>server whitelist remove <server-id>` · `>server whitelist list`"
      });
    }

    if (subcommand === "purge") {
      if (!(await ownerMgr.isOwner(userId))) {
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

      const loading = await message.reply({ content: "Scanning all servers on the panel..." });

      let allServers;
      try {
        allServers = await getAllPanelServers();
      } catch (err) {
        return loading.edit({ content: `Error fetching servers: \`${err.message}\``, components: [], flags: 0 });
      }

      const whitelist = await getWhitelist();
      const activePaidUuids = await getActivePaidUuids();
      const toDelete = allServers.filter((s) =>
        !isProtectedName(s.attributes.name) &&
        !whitelist.includes(s.attributes.identifier) &&
        !whitelist.includes(String(s.attributes.id)) &&
        !activePaidUuids.has(s.attributes.uuid)
      );
      const protectedCount = allServers.length - toDelete.length;

      if (toDelete.length === 0) {
        return loading.edit({
          content: null,
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Nothing To Purge"))
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `All \`${allServers.length}\` server(s) are protected (name contains \`${PURGE_CODEWORD}\`) or whitelisted.`
              ))
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const confirmId = `server_purge_confirm_${userId}`;
      const cancelId = `server_purge_cancel_${userId}`;

      const prompt = await loading.edit({
        content: null,
        components: [
          new ContainerBuilder()
            .setAccentColor(RED)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Confirm Server Purge"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
              `This will **permanently delete \`${toDelete.length}\`** server(s) that don't have \`${PURGE_CODEWORD}\` ` +
              `in their name and aren't whitelisted.\n` +
              `\`${protectedCount}\` server(s) will be left untouched.\n\n` +
              "**This cannot be undone.** You have 30 seconds to confirm."
            ))
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(confirmId).setLabel(`Purge ${toDelete.length} Servers`).setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(cancelId).setLabel("Cancel").setStyle(ButtonStyle.Secondary)
              )
            )
        ],
        flags: MessageFlags.IsComponentsV2,
      });

      const collector = prompt.createMessageComponentCollector({
        filter: (i) => i.user.id === userId,
        time: 30000,
        max: 1,
      });

      collector.on("collect", async (interaction) => {
        if (interaction.customId === cancelId) {
          return interaction.update({
            components: [
              new ContainerBuilder()
                .setAccentColor(PURPLE)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Purge Cancelled"))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("No servers were deleted."))
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        await interaction.update({
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Purging ${toDelete.length} Servers…`))
          ],
          flags: MessageFlags.IsComponentsV2,
        });

        let deleted = 0;
        let failed = 0;
        for (const s of toDelete) {
          try {
            await panel.deleteServer(s.attributes.id);
            deleted++;
            const ownerId = s.attributes.relationships?.user?.attributes?.id
              ? await panel.getUserIDfromUUID(s.attributes.uuid).catch(() => null)
              : null;
            await notifyServerDeleted(interaction.client, {
              userId: ownerId,
              serverName: s.attributes.name,
              identifier: s.attributes.identifier,
              reason: `Removed in a server purge by <@${userId}> (unprotected)`,
            });
          } catch (_) {
            failed++;
          }
        }

        await interaction.editReply({
          components: [
            new ContainerBuilder()
              .setAccentColor(GREEN)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Purge Complete"))
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `\`${deleted}\` server(s) deleted.` + (failed ? `\n\`${failed}\` failed and were left in place.` : "") +
                `\n\`${protectedCount}\` server(s) were protected and left untouched.`
              ))
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      });

      collector.on("end", async (collected) => {
        if (collected.size === 0) {
          try {
            await prompt.edit({
              components: [
                new ContainerBuilder()
                  .setAccentColor(PURPLE)
                  .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Purge Timed Out"))
                  .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
                  .addTextDisplayComponents(new TextDisplayBuilder().setContent("No response received — no servers were deleted."))
              ],
              flags: MessageFlags.IsComponentsV2,
            });
          } catch (_) {}
        }
      });

      return;
    }

    const userData = await db.getObject(userId);
    if (!userData) {
      return message.reply({
        components: [noAccountContainer()],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (subcommand === "protect") {
      const loading = await message.reply({ content: "Protecting your servers..." });
      try {
        const servers = await panel.getAllServers(userData.e_mail);
        if (!servers || servers.length === 0) {
          return loading.edit({ content: "You have no servers to protect.", components: [], flags: 0 });
        }

        const results = [];
        for (const s of servers) {
          const { name, identifier } = s.attributes;
          if (isProtectedName(name)) {
            results.push(`\`${name}\` — already protected`);
            continue;
          }
          const newName = `[${PURGE_CODEWORD}] ${name}`;
          try {
            await panel.renameServer(identifier, newName);
            results.push(`\`${name}\` → \`${newName}\``);
          } catch (e) {
            results.push(`\`${name}\` — failed: ${e.response?.status ?? e.message}`);
          }
        }

        return loading.edit({
          content: null,
          components: [
            new ContainerBuilder()
              .setAccentColor(GREEN)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Servers Protected"))
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(results.join("\n")))
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                "-# Servers with this codeword in their name are skipped during a `>server purge`."
              ))
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (err) {
        return loading.edit({ content: `Error: \`${err.message}\``, components: [], flags: 0 });
      }
    }

    if (subcommand === "list") {
      const loading = await message.reply({ content: "Fetching your servers..." });
      try {
        const servers = await panel.getAllServers(userData.e_mail);
        if (!servers || servers.length === 0) {
          await loading.edit({
            content: null,
            components: [
              new ContainerBuilder()
                .setAccentColor(PURPLE)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("# No Servers")
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    "You have no servers yet.\nRun `>server create <type>` to create one."
                  )
                )
            ],
            flags: MessageFlags.IsComponentsV2,
          });
          return;
        }

        const serverLines = servers.slice(0, 25).map((s, i) =>
          `**${i + 1}.** ${s.attributes.name}   \`${s.attributes.identifier}\``
        ).join("\n");

        await loading.edit({
          content: null,
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("# Your Servers")
              )
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# ${servers.length} server${servers.length !== 1 ? "s" : ""} found`)
              )
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(serverLines)
              )
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addSectionComponents(
                new SectionBuilder()
                  .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`-# ${process.env.FOOTER_TEXT}`)
                  )
                  .setButtonAccessory(
                    new ButtonBuilder()
                      .setLabel("Open Panel")
                      .setStyle(ButtonStyle.Link)
                      .setURL(process.env.PTERODACTYL_API_URL)
                  )
              )
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (err) {
        await loading.edit({ content: `Error: \`${err.message}\``, components: [], flags: 0 });
      }
      return;
    }

    if (subcommand === "create") {
      const type = args[1];
      if (!type) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("# Missing Server Type")
              )
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  "Usage: `>server create <type> [name]`\n\nRun `>server types` to see all options."
                )
              )
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (!ALLOWED_TYPES.includes(String(type).toLowerCase())) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("# Discord Bots Only")
              )
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `\`${type}\` is not available for self-service creation.\nOnly Discord bot servers can be created here: \`>server create bot [name]\`.`
                )
              )
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const serverName = args.slice(2).join("-") ||
        `${message.author.username}-${type}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").substring(0, 32);

      const loading = await message.reply({ content: `Creating **${type}** server...` });

      try {
        const existingServers = await panel.getAllServers(userData.e_mail);
        if (existingServers && existingServers.length >= MAX_SLOTS_PER_USER) {
          return loading.edit({
            content: null,
            components: [
              new ContainerBuilder()
                .setAccentColor(PURPLE)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("# Slot Limit Reached")
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    `You already have \`${existingServers.length}/${MAX_SLOTS_PER_USER}\` server slots in use.\nDelete an existing server with \`>server delete <name>\` before creating a new one.`
                  )
                )
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        const eggId = findEggId(type);
        if (!eggId) {
          return loading.edit({
            content: null,
            components: [
              new ContainerBuilder()
                .setAccentColor(PURPLE)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("# Unknown Server Type")
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    `\`${type}\` is not a recognised type.\nRun \`>server types\` to see all available options.`
                  )
                )
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        const result = await panel.createServer(
          userData.e_mail, serverName, eggId,
          FREE_LIMITS.memory, FREE_LIMITS.swap, FREE_LIMITS.disk,
          FREE_LIMITS.io, FREE_LIMITS.cpu,
          FREE_LIMITS.databases, FREE_LIMITS.backups
        );

        const serverId = result.data.attributes.identifier;
        const panelLink = `${process.env.PTERODACTYL_API_URL}/server/${serverId}`;
        const createdAt = new Date().toISOString().replace("T", " ").substring(0, 19);

        const allServers = await panel.getAllServers(userData.e_mail);
        const slotUsed = allServers ? allServers.length : 1;

        new WebhookLogger(client).logServerCreated({
          user: message.author,
          guild: message.guild,
          email: userData.e_mail,
          serverName,
          type,
          eggId,
          serverId,
          uuid: result.data.attributes.uuid,
          internalId: result.data.attributes.id,
          node: result.data.attributes.node,
          panelLink,
          limits: FREE_LIMITS,
        }).catch((err) => console.error("[WebhookLogger] logServerCreated failed:", err.message));

        await loading.edit({
          content: null,
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("# Server Created")
              )
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# ${userId}`)
              )
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `Server Name   \`${serverName}\`\n` +
                  `Type          \`${type.toUpperCase()}\`\n` +
                  `Server ID     \`${serverId}\`\n` +
                  `Slots Used    \`${slotUsed}/1\`\n` +
                  `Created at    \`${createdAt}\``
                )
              )
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addSectionComponents(
                new SectionBuilder()
                  .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`-# ${process.env.FOOTER_TEXT}`)
                  )
                  .setButtonAccessory(
                    new ButtonBuilder()
                      .setLabel("Open Panel")
                      .setStyle(ButtonStyle.Link)
                      .setURL(panelLink)
                  )
              )
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (err) {
        console.error("[server create] Error:", err);
        await loading.edit({
          content: null,
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("# Creation Failed")
              )
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `\`\`\`\n${err.message}\n\`\`\`\nPossible causes: no free allocations, API key permission issue.`
                )
              )
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }
      return;
    }

    if (subcommand === "delete") {
      const targetName = args.slice(1).join(" ");
      if (!targetName) {
        return message.reply({ content: "Usage: `>server delete <server-name>`" });
      }

      const loading = await message.reply({ content: `Looking up \`${targetName}\`...` });
      try {
        const servers = await panel.getAllServers(userData.e_mail);
        if (!servers || servers.length === 0) {
          return loading.edit({ content: "You have no servers to delete.", components: [], flags: 0 });
        }

        const server = servers.find(s =>
          s.attributes.name.toLowerCase() === targetName.toLowerCase() ||
          s.attributes.identifier === targetName
        );

        if (!server) {
          return loading.edit({
            content: null,
            components: [
              new ContainerBuilder()
                .setAccentColor(PURPLE)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("# Server Not Found")
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    `No server named \`${targetName}\` was found.\nRun \`>server list\` to see your servers.`
                  )
                )
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        await panel.deleteServer(server.attributes.id);
        await notifyServerDeleted(client, {
          userId,
          serverName: server.attributes.name,
          identifier: server.attributes.identifier,
          reason: `Deleted by the owner (<@${userId}>) via \`>server delete\``,
        });

        await loading.edit({
          content: null,
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("# Server Deleted")
              )
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `\`${server.attributes.name}\` has been permanently deleted.`
                )
              )
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (err) {
        await loading.edit({ content: `Error: \`${err.message}\``, components: [], flags: 0 });
      }
      return;
    }

    return message.reply({ content: `Unknown subcommand \`${subcommand}\`. Run \`>server help\` for usage, or \`>server whitelist\` / \`>server purge\` (owners only).` });
  }
};
