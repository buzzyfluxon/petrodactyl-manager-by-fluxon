// © flux0n. All rights reserved.
const { EmbedBuilder } = require("discord.js");
const { PanelManager } = require("./panelManager");
const { DataBaseInterface } = require("./dataBaseInterface");
const { BoostManager } = require("./boostManager");
const { BOOST_CHANNEL_ID, BOOST_TIERS, getTierForBoostCount } = require("./boostPerks");

const panel = new PanelManager(
  process.env.PTERODACTYL_API_URL,
  process.env.PTERODACTYL_API_KEY,
  process.env.PTERODACTYL_ACCOUNT_API_KEY
);
const db = new DataBaseInterface();
const boostManager = new BoostManager();
const PURPLE = 0x7c3aed;

function tierTableText() {
  return BOOST_TIERS.slice()
    .sort((a, b) => a.boosts - b.boosts)
    .map((tier) => `**${tier.boosts} Boost${tier.boosts > 1 ? "s" : ""}** — \`${tier.memory} MB RAM\`  \`${tier.cpu}% CPU\``)
    .join("\n");
}

async function sendBoostChannelEmbed(client, embed) {
  try {
    const channel = await client.channels.fetch(BOOST_CHANNEL_ID);
    if (!channel) return;
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[boostPerkApplier] Failed to send embed to boost channel:", err.message);
  }
}

async function applyPerkToUser(client, user, boostCount) {
  const tier = getTierForBoostCount(boostCount);
  const userData = await db.getObject(user.id);
  const wasBoostSuspended = await boostManager.wasSuspendedByBoostLoss(user.id);

  const embed = new EmbedBuilder()
    .setColor(PURPLE)
    .setAuthor({ name: `${user.tag} boosted the server!`, iconURL: user.displayAvatarURL() })
    .setTitle("🚀  Booster Perks")
    .setDescription(tier ? `Thanks for boosting! You're now on **${tier.label}**.` : "Thanks for boosting!")
    .addFields({ name: "Perk Tiers", value: tierTableText(), inline: false })
    .setFooter({ text: process.env.FOOTER_TEXT })
    .setTimestamp();

  if (!userData) {
    embed.addFields({
      name: "⚠️ No Panel Account Linked",
      value: "Link a panel account with `>user new` so your boost perks can be applied to a server.",
    });
    await sendBoostChannelEmbed(client, embed);
    return;
  }

  if (tier) {
    try {
      const servers = await panel.getAllServers(userData.e_mail);
      if (servers && servers.length > 0) {
        for (const server of servers) {
          await panel.updateServerLimits(server.attributes.id, tier.memory, tier.cpu);
          if (wasBoostSuspended) await panel.unSuspendServer(server.attributes.id);
        }
        if (wasBoostSuspended) await boostManager.setSuspendedByBoostLoss(user.id, false);
        embed.addFields({
          name: "✅ Applied",
          value: `\`${tier.memory} MB RAM\`  \`${tier.cpu}% CPU\` applied to ${servers.length} server${servers.length !== 1 ? "s" : ""}.`,
        });
      }
    } catch (err) {
      console.error("[boostPerkApplier] Failed to apply boost perk:", err.message);
      embed.addFields({ name: "⚠️ Error", value: `Could not apply perk automatically: \`${err.message}\`` });
    }
  }

  await sendBoostChannelEmbed(client, embed);
}

async function handleBoostLoss(client, member) {
  const userData = await db.getObject(member.id);
  await boostManager.setBoostCount(member.id, 0);

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setAuthor({ name: `${member.user.tag} is no longer boosting`, iconURL: member.user.displayAvatarURL() })
    .setTitle("💔  Boost Removed")
    .setFooter({ text: process.env.FOOTER_TEXT })
    .setTimestamp();

  if (!userData) {
    embed.setDescription("No linked panel account was found, so no server was suspended.");
    await sendBoostChannelEmbed(client, embed);
    return;
  }

  try {
    const servers = await panel.getAllServers(userData.e_mail);
    if (servers && servers.length > 0) {
      for (const server of servers) {
        await panel.suspendServer(server.attributes.id);
      }
      await boostManager.setSuspendedByBoostLoss(member.id, true);
      embed.setDescription(`Boost removed — ${servers.length} server${servers.length !== 1 ? "s" : ""} suspended.`);
    } else {
      embed.setDescription("Boost removed. This user has no servers to suspend.");
    }
  } catch (err) {
    console.error("[boostPerkApplier] Failed to suspend server after boost loss:", err.message);
    embed.setDescription(`Boost removed, but suspension failed: \`${err.message}\``);
  }

  await sendBoostChannelEmbed(client, embed);

  try {
    await member.send({ embeds: [embed] });
  } catch (err) {  }
}

module.exports = {
  boostManager,
  applyPerkToUser,
  handleBoostLoss,
};
