// © flux0n. All rights reserved.
const { MessageFlags } = require("discord.js");
const { buildHelpContainer } = require("../../commands/help");

module.exports = {
  customId: "help_category_select",

  async execute(interaction) {
    const selected = interaction.values[0];
    await interaction.update({
      components: [buildHelpContainer(selected)],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
