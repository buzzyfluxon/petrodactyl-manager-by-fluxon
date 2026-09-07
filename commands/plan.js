// © flux0n. All rights reserved.
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SectionBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const { PanelManager } = require("../core/panelManager");
const { DataBaseInterface } = require("../core/dataBaseInterface");
const { OwnerManager } = require("../core/ownerManager");
const { WebhookLogger } = require("../core/webhookLogger");
const { findEggId } = require("../core/serverTypes");
const axios = require("axios");

const panel = new PanelManager(
  process.env.PTERODACTYL_API_URL,
  process.env.PTERODACTYL_API_KEY,
  process.env.PTERODACTYL_ACCOUNT_API_KEY
);
const db = new DataBaseInterface();
const ownerMgr = new OwnerManager();
const PURPLE = 0x7c3aed;

const PLAN_ROLE_ID = process.env.PLAN_ROLE_ID || "1546396735491022950";

const PLAN_DEFAULTS = { swap: 0, io: 500, databases: 5, backups: 5 };
const DEFAULT_DAYS = 30;

const API = () => process.env.PTERODACTYL_API_URL;
const KEY = () => process.env.PTERODACTYL_API_KEY;
const hdrs = () => ({ Authorization: `Bearer ${KEY()}`, Accept: "application/json", "Content-Type": "application/json" });

async function getServerByIdentifier(identifier) {
  const res = await axios.get(`${API()}/api/application/servers?per_page=10000`, { headers: hdrs() });
  return res.data.data.find(s => s.attributes.identifier === identifier) || null;
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
    components: [c("Access Denied", "This command is restricted to bot owners and the plan manager role.")],
    flags: MessageFlags.IsComponentsV2,
  });
}

async function canManagePlans(message) {
  if (await ownerMgr.isOwner(message.author.id)) return true;
  return !!message.member?.roles?.cache?.has(PLAN_ROLE_ID);
}

function fmtDate(date) {
  return `<t:${Math.floor(new Date(date).getTime() / 1000)}:D>`;
}

module.exports = {
  name: "plan",

  async execute(message, args, client) {
    if (!(await canManagePlans(message))) return deny(message);

    const sub = args[0];

    if (!sub || sub === "help") {
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(PURPLE)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Plan Commands  -# Owner only"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
              "`>plan create @user <type> <ram> <disk> <cpu> [days] [name]` — Create a locked-spec plan server\n" +
              "`>plan renew <serverid> [days]` — Renew a plan, keeping remaining time\n\n" +
              "-# ram/disk in MB, cpu in %, days defaults to 30. Run `>server types` for `<type>` options."
            ))
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "create") {
      const targetArg = args[1];
      const type = args[2];
      const ram = Number(args[3]);
      const disk = Number(args[4]);
      const cpu = Number(args[5]);

      let rest = args.slice(6);
      let days = DEFAULT_DAYS;
      if (rest.length && /^\d+$/.test(rest[0])) {
        days = parseInt(rest[0], 10);
        rest = rest.slice(1);
      }

      if (!targetArg || !type || !ram || !disk || !cpu) {
        return message.reply({
          content: "Usage: `>plan create @user <type> <ram> <disk> <cpu> [days] [name]`\n" +
            "Example: `>plan create @John paper 4096 10240 200 30 johns-server`",
        });
      }

      const eggId = findEggId(type);
      if (!eggId) {
        return message.reply({ content: `Unknown type \`${type}\`. Run \`>server types\` to see options.` });
      }

      const discordId = targetArg.replace(/[<@!>]/g, "");
      if (!/^\d{17,19}$/.test(discordId)) {
        return message.reply({ content: "Please mention a user or provide a valid Discord ID." });
      }

      const userData = await db.getObject(discordId);
      if (!userData) {
        return message.reply({
          components: [c("No Panel Account", `<@${discordId}> has no linked panel account.\nRun \`>linkaccount <@user> <email>\` first.`)],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const serverName = (rest.join("-") ||
        `${discordId}-${type}`).toLowerCase().replace(/[^a-z0-9-]/g, "-").substring(0, 32);

      const loading = await message.reply({ content: `Creating **${type}** plan server for <@${discordId}>...` });

      try {
        const result = await panel.createServer(
          userData.e_mail, serverName, eggId,
          ram, PLAN_DEFAULTS.swap, disk,
          PLAN_DEFAULTS.io, cpu,
          PLAN_DEFAULTS.databases, PLAN_DEFAULTS.backups
        );

        const { uuid, identifier, id: internalId, node } = result.data.attributes;
        const panelLink = `${process.env.PTERODACTYL_API_URL}/server/${identifier}`;

        await panel.setServerRuntime(uuid, days, discordId, 0);
        const runtime = await panel.getServerRuntime(identifier);
        const expiresAt = runtime.status ? runtime.data.date_running_out.date : new Date(Date.now() + days * 86400000);

        new WebhookLogger(client).logPaidServerCreated({
          user: message.author,
          guild: message.guild,
          email: userData.e_mail,
          serverName, type, eggId,
          serverId: identifier,
          uuid, internalId, node, panelLink,
          limits: { memory: ram, swap: PLAN_DEFAULTS.swap, disk, io: PLAN_DEFAULTS.io, cpu, databases: PLAN_DEFAULTS.databases, backups: PLAN_DEFAULTS.backups },
        }).catch((err) => console.error("[WebhookLogger] logPaidServerCreated failed:", err.message));

        await loading.edit({
          content: null,
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Plan Server Created"))
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# <@${discordId}>`))
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `Server Name   \`${serverName}\`\n` +
                `Type          \`${type.toUpperCase()}\`\n` +
                `Server ID     \`${identifier}\`\n` +
                `Specs         \`${ram}MB RAM\`  \`${disk}MB Disk\`  \`${cpu}% CPU\`\n` +
                `Expires       ${fmtDate(expiresAt)}`
              ))
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addSectionComponents(
                new SectionBuilder()
                  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${process.env.FOOTER_TEXT}`))
                  .setButtonAccessory(
                    new ButtonBuilder().setLabel("Open Panel").setStyle(ButtonStyle.Link).setURL(panelLink)
                  )
              )
          ],
          flags: MessageFlags.IsComponentsV2,
        });

        try {
          const user = await client.users.fetch(discordId);
          await user.send({
            components: [c("Your Plan Server is Ready", `\`${serverName}\` has been set up.\nExpires ${fmtDate(expiresAt)} — renew before then to keep it running.`)],
            flags: MessageFlags.IsComponentsV2,
          });
        } catch (e) {  }

      } catch (err) {
        console.error("[plan create] Error:", err);
        await loading.edit({
          content: null,
          components: [c("Creation Failed", `\`\`\`\n${err.message}\n\`\`\``)],
          flags: MessageFlags.IsComponentsV2,
        });
      }
      return;
    }

    if (sub === "renew") {
      const identifier = args[1];
      const days = /^\d+$/.test(args[2]) ? parseInt(args[2], 10) : DEFAULT_DAYS;

      if (!identifier) {
        return message.reply({ content: "Usage: `>plan renew <serverid> [days]`" });
      }

      const loading = await message.reply({ content: `Renewing \`${identifier}\`...` });

      try {
        const srv = await getServerByIdentifier(identifier);
        if (!srv) {
          return loading.edit({ content: null, components: [c("Not Found", `No server found with ID \`${identifier}\`.`)], flags: MessageFlags.IsComponentsV2 });
        }

        const before = await panel.getServerRuntime(identifier);
        if (!before.status) {
          return loading.edit({
            content: null,
            components: [c("Not On a Plan", `\`${srv.attributes.name}\` isn't on a tracked plan, so there's nothing to renew.\nUse \`>plan create\` to put it on one.`)],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        await panel.extendRuntime(identifier, days);
        const after = await panel.getServerRuntime(identifier);
        const newExpiry = after.data.date_running_out.date;

        let unsuspended = false;
        if (srv.attributes.status === "suspended") {
          await panel.unSuspendServer(srv.attributes.id);
          unsuspended = true;
        }

        await loading.edit({
          content: null,
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Plan Renewed"))
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `\`${srv.attributes.name}\`  \`${identifier}\`\n` +
                `Added         \`+${days} days\`\n` +
                `New Expiry    ${fmtDate(newExpiry)}` +
                (unsuspended ? "\nServer was suspended — access has been restored." : "")
              ))
            ],
          flags: MessageFlags.IsComponentsV2,
        });

        try {
          const user = await client.users.fetch(before.data.user_id);
          await user.send({
            components: [c("Plan Renewed", `\`${srv.attributes.name}\` was renewed for **${days} days**.\nNew expiry: ${fmtDate(newExpiry)}`)],
            flags: MessageFlags.IsComponentsV2,
          });
        } catch (e) {  }

      } catch (err) {
        console.error("[plan renew] Error:", err);
        await loading.edit({
          content: null,
          components: [c("Error", `\`\`\`\n${err.message}\n\`\`\``)],
          flags: MessageFlags.IsComponentsV2,
        });
      }
      return;
    }

    return message.reply({ content: `Unknown subcommand \`${sub}\`. Run \`>plan\` for usage.` });
  }
};
