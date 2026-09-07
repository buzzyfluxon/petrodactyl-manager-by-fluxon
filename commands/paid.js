// © flux0n. All rights reserved.
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
} = require("discord.js");

const { DataBaseInterface } = require("../core/dataBaseInterface");
const { OwnerManager } = require("../core/ownerManager");
const { getPlan, formatPlanTable } = require("../core/paidPlans");
const { PanelManager } = require("../core/panelManager");
const { WebhookLogger } = require("../core/webhookLogger");
const { findEggId } = require("../core/serverTypes");
const axios = require("axios");

const db = new DataBaseInterface();
const ownerMgr = new OwnerManager();
const panel = new PanelManager(
  process.env.PTERODACTYL_API_URL,
  process.env.PTERODACTYL_API_KEY,
  process.env.PTERODACTYL_ACCOUNT_API_KEY
);

const PURPLE = 0x7c3aed;
const GREEN = 0x2ecc71;

const PAID_ROLE_ID = process.env.PAID_ROLE_ID || "1546364478369701899";
const PROTECTION_DAYS = 30;
const GRACE_DAYS = 7;

const NEW_SERVER_TYPE = "nodejs";
const NEW_SERVER_DEFAULTS = { swap: 0, io: 500, databases: 5, backups: 5 };

const PAID_LIST_KEY = "paid_protection_list";

const API = () => process.env.PTERODACTYL_API_URL;
const KEY = () => process.env.PTERODACTYL_API_KEY;
const hdrs = () => ({ Authorization: `Bearer ${KEY()}`, Accept: "application/json", "Content-Type": "application/json" });

async function findServersByName(name) {
  const res = await axios.get(`${API()}/api/application/servers?per_page=10000`, { headers: hdrs() });
  const lower = name.toLowerCase();
  return res.data.data.filter((s) => s.attributes.name.toLowerCase() === lower);
}

async function resizeServer(serverId, plan) {
  const details = await axios.get(`${API()}/api/application/servers/${serverId}`, { headers: hdrs() });
  const { limits, feature_limits, allocation } = details.data.attributes;
  await axios.patch(`${API()}/api/application/servers/${serverId}/build`, {
    allocation,
    memory: plan.ram,
    swap: limits.swap,
    disk: plan.disk,
    io: limits.io,
    cpu: plan.cpu,
    feature_limits,
  }, { headers: hdrs() });
}

async function getPaidList() {
  const list = await db.getObject(PAID_LIST_KEY);
  return Array.isArray(list) ? list : [];
}

function c(title, body, color = PURPLE) {
  return new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${title}`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
}

function fmtDate(date) {
  return `<t:${Math.floor(new Date(date).getTime() / 1000)}:D>`;
}

module.exports = {
  name: "paid",
  PAID_LIST_KEY,
  PAID_ROLE_ID,
  GRACE_DAYS,

  async execute(message, args, client) {
    if (!(await ownerMgr.isOwner(message.author.id))) {
      return message.reply({
        components: [c("Access Denied", "This command is restricted to bot owners.")],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const targetArg = args[0];
    const planArg = args[1];
    const serverName = args.slice(2).join(" ");

    if (!targetArg || !planArg) {
      return message.reply({
        components: [c(
          "Usage",
          "`>paid @user <plan> [server name]`\n" +
          "If `[server name]` matches an existing server, its specs are resized to the plan. " +
          "If omitted, a **brand new Node.js server** is created on that plan instead.\n\n" +
          `Either way it's protected for ${PROTECTION_DAYS} days (+${GRACE_DAYS}-day renewal grace), and the paid role is granted.\n\n` +
          formatPlanTable()
        )],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (!message.guild) {
      return message.reply({ content: "This command can only be used in a server." });
    }

    const plan = getPlan(planArg);
    if (!plan) {
      return message.reply({
        components: [c("Unknown Plan", `\`${planArg}\` isn't a plan. Available plans:\n\n${formatPlanTable()}`)],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const discordId = targetArg.replace(/[<@!>]/g, "");
    if (!/^\d{17,19}$/.test(discordId)) {
      return message.reply({ content: "Please mention a user or provide a valid Discord ID." });
    }

    if (!serverName) {
      return this._createNew(message, client, discordId, planArg, plan);
    }

    const loading = await message.reply({ content: `Setting up **${plan.label}** protection for \`${serverName}\`...` });

    try {
      const matches = await findServersByName(serverName);

      if (matches.length === 0) {
        return loading.edit({ content: null, components: [c("Not Found", `No server named \`${serverName}\` was found.`)], flags: MessageFlags.IsComponentsV2 });
      }

      if (matches.length > 1) {
        const list = matches.map((s) => `\`${s.attributes.name}\` — ID \`${s.attributes.identifier}\``).join("\n");
        return loading.edit({
          content: null,
          components: [c("Multiple Servers Found", `More than one server is named \`${serverName}\`:\n\n${list}\n\nRename one, or run this again once it's unique.`)],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const server = matches[0];
      const { uuid, identifier, id, name } = server.attributes;

      await resizeServer(id, plan);

      const now = Date.now();
      const protectedUntil = now + PROTECTION_DAYS * 86400000;

      const list = await getPaidList();
      const existing = list.find((e) => e.uuid === uuid);
      const isRenewal = !!existing;

      if (existing) {
        existing.protectedUntil = protectedUntil;
        existing.userId = discordId;
        existing.guildId = message.guild.id;
        existing.plan = planArg.toLowerCase();
      } else {
        list.push({ uuid, identifier, userId: discordId, guildId: message.guild.id, protectedUntil, plan: planArg.toLowerCase() });
      }
      await db.setObject(PAID_LIST_KEY, list);

      let roleGranted = false;
      try {
        const member = await message.guild.members.fetch(discordId);
        await member.roles.add(PAID_ROLE_ID);
        roleGranted = true;
      } catch (_) {  }

      await loading.edit({
        content: null,
        components: [
          c(
            isRenewal ? "Paid Protection Renewed" : "Paid Protection Granted",
            `\`${name}\`  \`${identifier}\`\n` +
            `User          <@${discordId}>\n` +
            `Plan          **${plan.label}** (\`${plan.price}\`)\n` +
            `Specs         \`${plan.ram}MB RAM\`  \`${plan.disk}MB Disk\`  \`${plan.cpu}% CPU\`\n` +
            `Protected Until   ${fmtDate(protectedUntil)}\n` +
            `Grace Period      ${GRACE_DAYS} days after that before deletion\n` +
            `Role              ${roleGranted ? "Granted" : "Failed to grant — assign it manually"}\n\n` +
            "-# Also exempt from the inactivity auto-cleanup for the duration.",
            GREEN
          )
        ],
        flags: MessageFlags.IsComponentsV2,
      });

      try {
        const user = await client.users.fetch(discordId);
        await user.send({
          components: [c(
            "You're Protected!",
            `Your server \`${name}\` is now on the **${plan.label}** plan and protected until ${fmtDate(protectedUntil)}.\n` +
            `If it isn't renewed by then, you'll get daily reminders for ${GRACE_DAYS} days before it's deleted.`
          )],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (_) {  }

    } catch (err) {
      console.error("[paid] Error:", err);
      await loading.edit({ content: null, components: [c("Error", `\`\`\`\n${err.message}\n\`\`\``)], flags: MessageFlags.IsComponentsV2 });
    }
  },

  async _createNew(message, client, discordId, planArg, plan) {
    const userData = await db.getObject(discordId);
    if (!userData) {
      return message.reply({
        components: [c("No Panel Account", `<@${discordId}> has no linked panel account.\nRun \`>linkaccount <@user> <email>\` first.`)],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const eggId = findEggId(NEW_SERVER_TYPE);
    const serverName = `${discordId}-${planArg}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").substring(0, 32);

    const loading = await message.reply({ content: `Creating a new **${plan.label}** server for <@${discordId}>...` });

    try {
      const result = await panel.createServer(
        userData.e_mail, serverName, eggId,
        plan.ram, NEW_SERVER_DEFAULTS.swap, plan.disk,
        NEW_SERVER_DEFAULTS.io, plan.cpu,
        NEW_SERVER_DEFAULTS.databases, NEW_SERVER_DEFAULTS.backups
      );

      const { uuid, identifier, id: internalId, node } = result.data.attributes;
      const panelLink = `${process.env.PTERODACTYL_API_URL}/server/${identifier}`;

      new WebhookLogger(client).logPaidServerCreated({
        user: message.author,
        guild: message.guild,
        email: userData.e_mail,
        serverName, type: NEW_SERVER_TYPE, eggId,
        serverId: identifier,
        uuid, internalId, node, panelLink,
        limits: { memory: plan.ram, swap: NEW_SERVER_DEFAULTS.swap, disk: plan.disk, io: NEW_SERVER_DEFAULTS.io, cpu: plan.cpu, databases: NEW_SERVER_DEFAULTS.databases, backups: NEW_SERVER_DEFAULTS.backups },
      }).catch((err) => console.error("[WebhookLogger] logPaidServerCreated failed:", err.message));

      const now = Date.now();
      const protectedUntil = now + PROTECTION_DAYS * 86400000;

      const list = await getPaidList();
      list.push({ uuid, identifier, userId: discordId, guildId: message.guild.id, protectedUntil, plan: planArg.toLowerCase() });
      await db.setObject(PAID_LIST_KEY, list);

      let roleGranted = false;
      try {
        const member = await message.guild.members.fetch(discordId);
        await member.roles.add(PAID_ROLE_ID);
        roleGranted = true;
      } catch (_) {  }

      await loading.edit({
        content: null,
        components: [
          c(
            "Paid Server Created",
            `\`${serverName}\`  \`${identifier}\`\n` +
            `User          <@${discordId}>\n` +
            `Plan          **${plan.label}** (\`${plan.price}\`)\n` +
            `Specs         \`${plan.ram}MB RAM\`  \`${plan.disk}MB Disk\`  \`${plan.cpu}% CPU\`\n` +
            `Protected Until   ${fmtDate(protectedUntil)}\n` +
            `Grace Period      ${GRACE_DAYS} days after that before deletion\n` +
            `Role              ${roleGranted ? "Granted" : "Failed to grant — assign it manually"}\n\n` +
            "-# Also exempt from the inactivity auto-cleanup for the duration.\n" +
            "-# Created as Node.js by default — you can change the server type in your server settings.",
            GREEN
          )
        ],
        flags: MessageFlags.IsComponentsV2,
      });

      try {
        const user = await client.users.fetch(discordId);
        await user.send({
          components: [c(
            "Your Paid Server is Ready",
            `\`${serverName}\` was created on the **${plan.label}** plan and protected until ${fmtDate(protectedUntil)}.\n` +
            `It's set up as Node.js by default — you can change the server type in your server settings.\n` +
            `If it isn't renewed by then, you'll get daily reminders for ${GRACE_DAYS} days before it's deleted.`
          )],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (_) {  }

    } catch (err) {
      console.error("[paid create] Error:", err);
      await loading.edit({ content: null, components: [c("Creation Failed", `\`\`\`\n${err.message}\n\`\`\``)], flags: MessageFlags.IsComponentsV2 });
    }
  },
};
