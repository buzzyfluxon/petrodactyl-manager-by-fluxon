// © flux0n. All rights reserved.
const { EmbedBuilder } = require("discord.js");

const NOTIFY_CHANNEL_ID = process.env.NOTIFY_CHANNEL_ID || "1546108683656761404";

async function notifyServerDeleted(client, { userId, serverName, identifier, reason }) {
  const embed = new EmbedBuilder()
    .setTitle("🗑️  Server Deleted")
    .setDescription(
      `\`${serverName || identifier || "Unknown server"}\` has been permanently deleted.` +
      (reason ? `\n**Reason:** ${reason}` : "")
    )
    .setColor("DarkRed")
    .setFooter({ text: process.env.FOOTER_TEXT })
    .setTimestamp();

  if (userId) {
    try {
      const user = await client.users.fetch(userId);
      await user.send({ embeds: [embed] });
    } catch (err) {  }
  }

  try {
    const channel = await client.channels.fetch(NOTIFY_CHANNEL_ID);
    if (channel) {
      await channel.send({
        content: userId ? `<@${userId}>` : undefined,
        embeds: [embed],
      });
    }
  } catch (err) {
    console.error("[deletionNotifier] Failed to post to notify channel:", err.message);
  }
}

module.exports = {
  NOTIFY_CHANNEL_ID,
  notifyServerDeleted,
};
