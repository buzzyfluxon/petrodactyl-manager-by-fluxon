// © flux0n. All rights reserved.
﻿

const {
  ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, MessageFlags,
} = require("discord.js");

const { OwnerManager } = require("../core/ownerManager");
const ownerMgr = new OwnerManager();
const PURPLE = 0x7c3aed;

function deny(message) {
  return message.reply({
    components: [
      new ContainerBuilder()
        .setAccentColor(PURPLE)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("# Access Denied")
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("This command is restricted to bot owners.")
        )
    ],
    flags: MessageFlags.IsComponentsV2,
  });
}

module.exports = {
  name: "owner",

  async execute(message, args) {
    const userId = message.author.id;
    const isOwner = await ownerMgr.isOwner(userId);
    if (!isOwner) return deny(message);

    const subcommand = args[0];

    if (!subcommand || subcommand === "list") {
      const owners = await ownerMgr.getOwners();
      const lines = owners.map((id, i) => `\`${i + 1}.\` <@${id}>  \`${id}\``).join("\n") || "No owners set.";
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(PURPLE)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("# Bot Owners")
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`-# ${owners.length} owner${owners.length !== 1 ? "s" : ""} registered`)
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(lines)
            )
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (subcommand === "add") {
      const target = args[1];
      if (!target) {
        return message.reply({ content: "Usage: `>owner add <@user or ID>`" });
      }
      const targetId = target.replace(/[<@!>]/g, "");
      if (!/^\d+$/.test(targetId)) {
        return message.reply({ content: "Please mention a user or provide a valid Discord ID." });
      }

      const added = await ownerMgr.addOwner(targetId);
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(PURPLE)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(added ? "# Owner Added" : "# Already an Owner")
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                added
                  ? `<@${targetId}> \`${targetId}\` has been added as a bot owner.`
                  : `<@${targetId}> is already an owner.`
              )
            )
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (subcommand === "remove") {
      const target = args[1];
      if (!target) {
        return message.reply({ content: "Usage: `>owner remove <@user or ID>`" });
      }
      const targetId = target.replace(/[<@!>]/g, "");
      if (!/^\d+$/.test(targetId)) {
        return message.reply({ content: "Please mention a user or provide a valid Discord ID." });
      }

      const owners = await ownerMgr.getOwners();
      if (targetId === userId && owners.length === 1) {
        return message.reply({ content: "You cannot remove yourself as the only owner." });
      }

      const removed = await ownerMgr.removeOwner(targetId);
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(PURPLE)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(removed ? "# Owner Removed" : "# Not an Owner")
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                removed
                  ? `<@${targetId}> \`${targetId}\` has been removed from bot owners.`
                  : `<@${targetId}> is not in the owner list.`
              )
            )
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    return message.reply({
      content: "Available: `>owner list` `>owner add <id>` `>owner remove <id>`",
    });
  }
};
