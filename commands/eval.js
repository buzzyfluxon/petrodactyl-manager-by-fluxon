// © flux0n. All rights reserved.
﻿

const {
  ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, MessageFlags,
} = require("discord.js");
const util = require("util");
const { OwnerManager } = require("../core/ownerManager");
const { PanelManager } = require("../core/panelManager");
const { DataBaseInterface } = require("../core/dataBaseInterface");
const ownerMgr = new OwnerManager();
const panel = new PanelManager(
  process.env.PTERODACTYL_API_URL,
  process.env.PTERODACTYL_API_KEY,
  process.env.PTERODACTYL_ACCOUNT_API_KEY
);
const db = new DataBaseInterface();
const PURPLE = 0x7c3aed;

module.exports = {
  name: "eval",

  async execute(message, args, client) {
    if (!(await ownerMgr.isOwner(message.author.id))) {
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

    const code = args.join(" ");
    if (!code) return message.reply("Please provide code to evaluate.");

    try {

      let evaled = eval(code);

      if (evaled instanceof Promise) {
        evaled = await evaled;
      }

      let output = util.inspect(evaled, { depth: 1 });

      if (output.length > 2000) {
        output = output.substring(0, 2000) + "\n... (output truncated)";
      }

      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(PURPLE)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Eval Output"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`\`\`\`js\n${output}\n\`\`\``)
            )
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (err) {

      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0xe74c3c)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Eval Error"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`\`\`\`js\n${err}\n\`\`\``)
            )
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  }
};
