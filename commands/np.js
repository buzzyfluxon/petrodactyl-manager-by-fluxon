// © flux0n. All rights reserved.
﻿

const {
  ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, MessageFlags,
} = require("discord.js");

const { OwnerManager } = require("../core/ownerManager");
const { NoPrefixManager } = require("../core/noPrefixManager");

const ownerMgr = new OwnerManager();
const npMgr = new NoPrefixManager();
const PURPLE = 0x7c3aed;

function deny(message) {
  return message.reply({
    components: [
      new ContainerBuilder()
        .setAccentColor(PURPLE)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Access Denied"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("This command is restricted to bot owners."))
    ],
    flags: MessageFlags.IsComponentsV2,
  });
}

module.exports = {
  name: "np",

  async execute(message, args) {
    const userId = message.author.id;
    if (!(await ownerMgr.isOwner(userId))) return deny(message);

    const subcommand = args[0];

    if (!subcommand || subcommand === "list") {
      const users = await npMgr.getUsers();
      const lines = users.map((id, i) => `\`${i + 1}.\` <@${id}>  \`${id}\``).join("\n") || "No no-prefix users set.";
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(PURPLE)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("# No-Prefix Users"))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${users.length} user${users.length !== 1 ? "s" : ""} registered`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines))
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (subcommand === "add") {
      const target = args[1];
      if (!target) return message.reply({ content: "Usage: `>np add <@user or ID>`" });

      const targetId = target.replace(/[<@!>]/g, "");
      if (!/^\d+$/.test(targetId)) return message.reply({ content: "Please mention a user or provide a valid Discord ID." });

      const added = await npMgr.add(targetId);
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(PURPLE)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(added ? "# No-Prefix Added" : "# Already Allowed"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                added
                  ? `<@${targetId}> \`${targetId}\` can now use commands without a prefix.`
                  : `<@${targetId}> already has no-prefix access.`
              )
            )
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (subcommand === "remove") {
      const target = args[1];
      if (!target) return message.reply({ content: "Usage: `>np remove <@user or ID>`" });

      const targetId = target.replace(/[<@!>]/g, "");
      if (!/^\d+$/.test(targetId)) return message.reply({ content: "Please mention a user or provide a valid Discord ID." });

      const removed = await npMgr.remove(targetId);
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(PURPLE)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(removed ? "# No-Prefix Removed" : "# Not Allowed"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                removed
                  ? `<@${targetId}> \`${targetId}\` has been removed from the no-prefix list.`
                  : `<@${targetId}> does not have no-prefix access.`
              )
            )
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    return message.reply({
      content: "Available: `>np list` `>np add <id>` `>np remove <id>`",
    });
  }
};
