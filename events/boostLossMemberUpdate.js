// © flux0n. All rights reserved.
const { handleBoostLoss } = require("../core/boostPerkApplier");

module.exports = {
  name: "guildMemberUpdate",
  once: false,

  async execute(oldMember, newMember, client) {
    const wasBoosting = !!oldMember.premiumSinceTimestamp;
    const isBoosting = !!newMember.premiumSinceTimestamp;

    if (wasBoosting && !isBoosting) {
      try {
        await handleBoostLoss(client, newMember);
      } catch (err) {
        console.error("[boostLossMemberUpdate] Failed to process boost loss:", err.message);
      }
    }
  },
};
