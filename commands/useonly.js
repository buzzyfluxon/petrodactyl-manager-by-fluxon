// © flux0n. All rights reserved.
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
} = require("discord.js");

const { DataBaseInterface } = require("../core/dataBaseInterface");
const { OwnerManager } = require("../core/ownerManager");

const db = new DataBaseInterface();
const ownerMgr = new OwnerManager();
const PURPLE = 0x7c3aed;
const RED = 0xe74c3c;
const GREEN = 0x2ecc71;
const USEONLY_KEY = "useonly_channels";

function c(title, body, color = PURPLE) {
  return new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${title}`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
}

async function isAdmin(message) {
  if (message.member?.permissions.has("Administrator")) return true;
  return await ownerMgr.isOwner(message.author.id);
}

async function getMap() {
  const data = await db.getObject(USEONLY_KEY);
  return data && typeof data === "object" ? data : {};
}

module.exports = {
  name: "useonly",
  USEONLY_KEY,

  async execute(message, args) {
    if (!(await isAdmin(message))) {
      return message.reply({
        components: [c("Access Denied", "This command is restricted to administrators.", RED)],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (!message.guild) {
      return message.reply({ content: "This command can only be used in a server." });
    }

    const map = await getMap();
    const target = args[0];

    if (!target) {
      const current = map[message.guild.id];
      return message.reply({
        components: [
          c(
            "Restricted Channel",
            current
              ? `Members can currently only use bot commands in <#${current}>.\nAdmins can use commands anywhere.`
              : "No restriction is set — members can use bot commands in any channel.\n\nUsage: `>useonly #channel` to restrict, `>useonly off` to clear."
          )
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (["off", "clear", "none", "reset"].includes(target.toLowerCase())) {
      if (!map[message.guild.id]) {
        return message.reply({ content: "No restriction is currently set." });
      }
      delete map[message.guild.id];
      await db.setObject(USEONLY_KEY, map);
      return message.reply({
        components: [c("Restriction Cleared", "Members can now use bot commands in any channel again.", GREEN)],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const channelId = target.replace(/[<#>]/g, "");
    const channel = message.guild.channels.cache.get(channelId);
    if (!channel) {
      return message.reply({ content: "Usage: `>useonly #channel` or `>useonly off`" });
    }

    map[message.guild.id] = channel.id;
    await db.setObject(USEONLY_KEY, map);

    return message.reply({
      components: [
        c(
          "Restriction Set",
          `Members can now only use bot commands in ${channel}.\nAdmins can still use commands anywhere.`,
          GREEN
        )
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
