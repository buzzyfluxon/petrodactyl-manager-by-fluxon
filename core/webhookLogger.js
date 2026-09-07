// © flux0n. All rights reserved.
const { WebhookClient, EmbedBuilder } = require("discord.js");

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || "1545778558389985405";
const PAID_LOG_CHANNEL_ID = process.env.PAID_LOG_CHANNEL_ID || "1546396564019355730";
const WEBHOOK_NAME = "Fluxon Server Logs";
const ACCENT_COLOR = 0x7c3aed;
const PREMIUM_COLOR = 0xf1c40f;

class WebhookLogger {
  constructor(client) {
    this.client = client;
    this.webhookClients = new Map();
  }

  async _getWebhook(channelId = LOG_CHANNEL_ID) {
    if (this.webhookClients.has(channelId)) return this.webhookClients.get(channelId);

    const channel = await this.client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      console.error(`[WebhookLogger] Could not find/access channel ${channelId}`);
      return null;
    }

    let webhook = null;
    const existing = await channel.fetchWebhooks().catch(() => null);
    if (existing) webhook = existing.find((wh) => wh.name === WEBHOOK_NAME);

    if (!webhook) {
      webhook = await channel
        .createWebhook({
          name: WEBHOOK_NAME,
          avatar: this.client.user.displayAvatarURL(),
          reason: "Automated server-creation logging",
        })
        .catch((err) => {
          console.error("[WebhookLogger] Failed to create webhook:", err.message);
          return null;
        });
    }

    if (!webhook) return null;

    const webhookClient = new WebhookClient({ id: webhook.id, token: webhook.token });
    this.webhookClients.set(channelId, webhookClient);
    return webhookClient;
  }

  async logServerCreated(data) {
    return this._sendServerCreated(data, { channelId: LOG_CHANNEL_ID, color: ACCENT_COLOR, paid: false });
  }

  async logPaidServerCreated(data) {
    return this._sendServerCreated(data, { channelId: PAID_LOG_CHANNEL_ID, color: PREMIUM_COLOR, paid: true });
  }

  async _sendServerCreated({
    user,
    guild,
    email,
    serverName,
    type,
    eggId,
    serverId,
    uuid,
    internalId,
    node,
    panelLink,
    limits,
  }, { channelId = LOG_CHANNEL_ID, color = ACCENT_COLOR, paid = false } = {}) {
    const webhookClient = await this._getWebhook(channelId);
    if (!webhookClient) return;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: `${user.tag} created a ${paid ? "paid " : ""}server`,
        iconURL: user.displayAvatarURL(),
      })
      .setTitle(paid ? "💎  New Paid Server Created" : "🖥️  New Server Created")
      .setThumbnail(this.client.user.displayAvatarURL())
      .addFields(
        { name: "👤 Created By", value: `${user} \`(${user.id})\``, inline: true },
        { name: "🏠 Guild", value: `${guild?.name ?? "Unknown"} \`(${guild?.id ?? "N/A"})\``, inline: true },
        { name: "📧 Panel Email", value: `\`${email}\``, inline: true },

        { name: "🏷️ Server Name", value: `\`${serverName}\``, inline: true },
        { name: "🧩 Type", value: `\`${type.toUpperCase()}\` (egg \`${eggId}\`)`, inline: true },
        { name: "🌐 Node", value: `\`${node ?? "N/A"}\``, inline: true },

        { name: "🆔 Identifier", value: `\`${serverId}\``, inline: true },
        { name: "🔑 UUID", value: `\`${uuid ?? "N/A"}\``, inline: true },
        { name: "🗂️ Internal ID", value: `\`${internalId ?? "N/A"}\``, inline: true },

        {
          name: "⚙️ Resources",
          value:
            `**RAM:** \`${limits?.memory ?? "?"} MB\`   ` +
            `**Disk:** \`${limits?.disk ?? "?"} MB\`   ` +
            `**CPU:** \`${limits?.cpu ?? "?"}%\`\n` +
            `**Swap:** \`${limits?.swap ?? "?"} MB\`   ` +
            `**IO:** \`${limits?.io ?? "?"}\``,
          inline: false,
        },
        { name: "🕒 Created At", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
        { name: "🔗 Panel Link", value: `[Open in Panel](${panelLink})`, inline: false }
      )
      .setFooter({ text: paid ? "Fluxon Premium" : "flux0n is the goat", iconURL: this.client.user.displayAvatarURL() })
      .setTimestamp();

    await webhookClient
      .send({
        username: paid ? "Fluxon Premium Logs" : "Fluxon Server Logs",
        avatarURL: this.client.user.displayAvatarURL(),
        embeds: [embed],
      })
      .catch((err) => console.error("[WebhookLogger] Failed to send log:", err.message));
  }
}

module.exports = { WebhookLogger };
