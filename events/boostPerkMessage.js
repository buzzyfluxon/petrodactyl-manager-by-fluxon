// © flux0n. All rights reserved.
const { MessageType } = require("discord.js");
const { boostManager, applyPerkToUser } = require("../core/boostPerkApplier");

module.exports = {
  name: "messageCreate",
  once: false,

  async execute(message, client) {
    if (message.type !== MessageType.GuildBoost) return;

    const user = message.author;
    if (!user) return;

    try {
      const currentCount = await boostManager.getBoostCount(user.id);
      const newCount = currentCount + 1;
      await boostManager.setBoostCount(user.id, newCount);
      await applyPerkToUser(client, user, newCount);
    } catch (err) {
      console.error("[boostPerkMessage] Failed to process boost message:", err.message);
    }
  },
};
