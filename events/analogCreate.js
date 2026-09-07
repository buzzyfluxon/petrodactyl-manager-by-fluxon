// © flux0n. All rights reserved.
const path = require("path");
const { EmbedBuilder } = require("discord.js");
const { NoPrefixManager } = require("../core/noPrefixManager");
const { DataBaseInterface } = require("../core/dataBaseInterface");
const { OwnerManager } = require("../core/ownerManager");

const prefixCommands = new Map();
const commandFiles = require("glob").sync(
  path.join(__dirname, "../commands/*.js").replace(/\\/g, "/")
);
for (const file of commandFiles) {
  const cmd = require(file);
  prefixCommands.set(cmd.name, cmd);
}

const PREFIX = process.env.BOT_PREFIX || ">";
const npMgr = new NoPrefixManager();
const restrictDb = new DataBaseInterface();
const ownerMgr = new OwnerManager();
const USEONLY_KEY = "useonly_channels";

async function isAdminMember(message) {
  if (message.member?.permissions.has("Administrator")) return true;
  return await ownerMgr.isOwner(message.author.id);
}

async function isAllowedChannel(message) {
  if (!message.guild) return true;
  const map = await restrictDb.getObject(USEONLY_KEY);
  const restrictedChannel = map && map[message.guild.id];
  if (!restrictedChannel) return true;
  if (message.channel.id === restrictedChannel) return true;
  return await isAdminMember(message);
}

const restrictionWarnCooldowns = new Map();
const RESTRICTION_WARN_WINDOW_MS = 15000;

function shouldWarnForRestriction(guildId, userId) {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const expiresAt = restrictionWarnCooldowns.get(key);
  if (expiresAt && now < expiresAt) return false;
  restrictionWarnCooldowns.set(key, now + RESTRICTION_WARN_WINDOW_MS);
  return true;
}

const WARN_EMOJI = process.env.EMOJI_WARN || "<:warn:1546265290873114644>";
const DEFAULT_COOLDOWN_MS = 4000;
const COOLDOWN_OVERRIDES_MS = {
  ping: 3000,
  help: 3000,
  user: 5000,
  server: 6000,
  status: 10000,
  admin: 6000,
  stats: 8000,
  plan: 6000,
  owner: 5000,
  np: 5000,
  linkaccount: 5000,
  pdm: 5000,
};

const cooldowns = new Map();

function checkCooldown(commandName, userId) {
  const duration = COOLDOWN_OVERRIDES_MS[commandName] ?? DEFAULT_COOLDOWN_MS;
  const key = `${commandName}:${userId}`;
  const now = Date.now();
  const entry = cooldowns.get(key);

  if (entry && now < entry.expiresAt) {
    if (entry.warned) return { action: "ignore" };
    entry.warned = true;
    return { action: "warn", remaining: entry.expiresAt - now };
  }

  cooldowns.set(key, { expiresAt: now + duration, warned: false });
  return { action: "proceed" };
}

const WARN_COLOR = 0xf1c40f;
const WARN_AUTO_DELETE_MS = 6000;

async function sendWarning(message, embed) {
  try {
    const sent = await message.reply({ embeds: [embed] });
    setTimeout(() => sent.delete().catch(() => {}), WARN_AUTO_DELETE_MS);
    return sent;
  } catch (_) {}
}

function cooldownEmbed(commandName, remaining) {
  return new EmbedBuilder()
    .setColor(WARN_COLOR)
    .setDescription(
      `${WARN_EMOJI}  **Slow down** — you can use \`${commandName}\` again in \`${(remaining / 1000).toFixed(1)}s\`.`
    );
}

function restrictedChannelEmbed(channelId) {
  return new EmbedBuilder()
    .setColor(WARN_COLOR)
    .setDescription(`${WARN_EMOJI}  You can only use bot commands in <#${channelId}>.`);
}

const ALIAS_MAP = {
  suspend:   { cmd: "admin", inject: "suspend"   },
  unsuspend: { cmd: "admin", inject: "unsuspend" },
  delete:    { cmd: "admin", inject: "delete"    },
  servers:   { cmd: "admin", inject: "servers"   },
  stats:     { cmd: "stats", inject: null        },
  owners:    { cmd: "owner", inject: "list"      },
  eval:      { cmd: "eval",  inject: null        },
};

module.exports = {
  name: "messageCreate",
  once: false,

  async execute(message, client) {
    if (message.author.bot) return;

    const content = message.content.trim();
    let args;
    let commandName;
    let injectedSub = null;

    if (content.startsWith(PREFIX)) {

      args = content.slice(PREFIX.length).trim().split(/\s+/);
      commandName = args.shift().toLowerCase();
    } else {

      const isNp = await npMgr.isAllowed(message.author.id);
      if (!isNp) return;

      args = content.split(/\s+/);
      const bareCmd = args.shift().toLowerCase();

      if (ALIAS_MAP[bareCmd]) {
        commandName = ALIAS_MAP[bareCmd].cmd;
        injectedSub = ALIAS_MAP[bareCmd].inject;
      } else {
        commandName = bareCmd;
      }
    }

    if (!(await isAllowedChannel(message))) {
      if (shouldWarnForRestriction(message.guild.id, message.author.id)) {
        const map = await restrictDb.getObject(USEONLY_KEY);
        return sendWarning(message, restrictedChannelEmbed(map[message.guild.id]));
      }
      return;
    }

    if (commandName === "ping") {
      const result = checkCooldown("ping", message.author.id);
      if (result.action === "ignore") return;
      if (result.action === "warn") return sendWarning(message, cooldownEmbed("ping", result.remaining));
      const ms = Date.now() - message.createdTimestamp;
      return message.reply(`Pong!  Latency: \`${ms}ms\`  |  API: \`${Math.round(client.ws.ping)}ms\``);
    }
    if (commandName === "pdm" && args[0] === "reload") {
      if (!message.member?.permissions.has("Administrator")) return;
      const result = checkCooldown("pdm", message.author.id);
      if (result.action === "ignore") return;
      if (result.action === "warn") return sendWarning(message, cooldownEmbed("pdm", result.remaining));
      const newFiles = require("glob").sync(
        path.join(__dirname, "../commands/*.js").replace(/\\/g, "/")
      );
      prefixCommands.clear();
      for (const file of newFiles) {
        delete require.cache[require.resolve(file)];
        const cmd = require(file);
        prefixCommands.set(cmd.name, cmd);
      }
      return message.reply(`Reloaded **${prefixCommands.size}** commands.`);
    }

    const command = prefixCommands.get(commandName);
    if (!command) return;

    const result = checkCooldown(commandName, message.author.id);
    if (result.action === "ignore") return;
    if (result.action === "warn") return sendWarning(message, cooldownEmbed(commandName, result.remaining));

    if (injectedSub) {
      args.unshift(injectedSub);
    }

    try {
      await command.execute(message, args, client);
    } catch (err) {
      console.error(`[Command] "${commandName}" failed:`, err);
      message.reply(`An error occurred: \`${err.message}\``).catch(() => {});
    }
  },
};
