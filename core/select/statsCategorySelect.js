// © flux0n. All rights reserved.
﻿

const { MessageFlags } = require("discord.js");
const { OwnerManager } = require("../ownerManager");
const { buildStatsContainer, fetchStatsData, cache } = require("../../commands/stats");

const ownerMgr = new OwnerManager();
const CACHE_TTL = 60_000;

module.exports = {
  customId: "stats_category_select",

  async execute(interaction) {
    if (!(await ownerMgr.isOwner(interaction.user.id))) {
      return interaction.reply({ content: "Access denied.", ephemeral: true });
    }

    const page = interaction.values[0];
    const userId = interaction.user.id;

    let statsData;
    const cached = cache.get(userId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      statsData = cached.data;
    } else {
      await interaction.deferUpdate();
      try {
        statsData = await fetchStatsData();
        cache.set(userId, { data: statsData, ts: Date.now() });
      } catch (err) {
        return interaction.editReply({ content: `Failed to refresh stats: \`${err.message}\`` });
      }
    }

    await interaction.update({
      components: [buildStatsContainer(page, statsData)],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
