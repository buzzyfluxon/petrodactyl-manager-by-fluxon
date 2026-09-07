// © flux0n. All rights reserved.
const { Client, EmbedBuilder } = require("discord.js");
const { PanelManager } = require("../panelManager");
const { TranslationManager } = require("../translationManager");
const { EmojiManager } = require("../emojiManager")
var CronJob = require('cron').CronJob;

const NOTIFY_CHANNEL_ID = process.env.NOTIFY_CHANNEL_ID || "1546108683656761404";

async function notify(client, { userId, title, description, color }) {
  try {
    const user = await client.users.fetch(userId);
    await user.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(color)
          .setFooter({ text: process.env.FOOTER_TEXT })
          .setTimestamp()
      ]
    });
  } catch (error) {  }

  try {
    const channel = await client.channels.fetch(NOTIFY_CHANNEL_ID);
    if (channel) {
      await channel.send({
        content: `<@${userId}>`,
        embeds: [
          new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setFooter({ text: process.env.FOOTER_TEXT })
            .setTimestamp()
        ]
      });
    }
  } catch (error) {
    console.error("[dailyRuntime] Failed to post notify channel message:", error.message);
  }
}

module.exports = {
  customId: "dailyRuntime",

  async execute(client, panel, database, emojiManager) {

    var job = new CronJob(
      "0 0 0 * * *",
      async function () {
        const serverIconURL = undefined;
        let suspensionList = await panel.getRuntimeList(), deletionList = await panel.getDeletionList(), currentDate = new Date().setHours(0, 0, 0, 0)

        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today.getTime() + 86400000);

        console.log("Checking for runtime...");

        if (suspensionList != null) {

          let serversToRemind = suspensionList.filter(server => {
            let { date_running_out: { date } } = server
            let expiry = new Date(date); expiry.setHours(0, 0, 0, 0);
            return expiry.getTime() === tomorrow.getTime();
          })

          for (let server of serversToRemind) {
            let { user_id: userId, date_running_out: { date }, uuid } = server, user = await client.users.fetch(userId)

            let serverIdentifier = await panel.getServerIdentifier(uuid)
            if (serverIdentifier == null) {
              await panel.removeServerSuspensionList(uuid)
              await panel.removeServerDeletionList(uuid)
              continue
            }
            let serverData = await panel.getServerInfo(serverIdentifier), { attributes: { name } } = serverData

            const translate = new TranslationManager(userId)
            const t = async function (key) {
              return await translate.getTranslation(key)
            }

            try {
              await user.send({
                embeds: [
                  new EmbedBuilder()
                    .setTitle(`${await emojiManager.getEmoji("emoji_logo")}  ${await t("server_manager.main_label")}`)
                    .setDescription(`${await emojiManager.getEmoji("emoji_arrow_down_right")} **${await t("reminder.text")}**`)
                    .addFields([
                      {
                        name: `${await emojiManager.getEmoji("emoji_arrow_down_right")} **${await t("add_item_button.modal_name")}**`,
                        value: `\`\`\`js\n${name}\`\`\``,
                        inline: true
                      },
                      {
                        name: `${await emojiManager.getEmoji("emoji_arrow_down_right")} **${await t("serverinfo.suspension_label")}**`,
                        value: `<t:${Math.floor(new Date(date).setHours(0, 0, 0, 0) / 1000)}>`,
                        inline: false
                      }
                    ])
                    .setColor("Red")
                    .setFooter({ text: process.env.FOOTER_TEXT, iconURL: serverIconURL })
                    .setTimestamp()
                ]
              })
            } catch (error) {

            }
          }
        }

        if (deletionList != null) {
          let serversToDelete = deletionList.filter(server => {
            let { uuid, deletion_date: { date } } = server
            return currentDate >= new Date(date).setHours(0, 0, 0, 0)
          })

          for (let server of serversToDelete) {
            let { uuid, user_id: userId } = server, serverId = await panel.getServerId(uuid)

            let serverIdentifier = await panel.getServerIdentifier(uuid)
            if (serverIdentifier == null) {
              await panel.removeServerSuspensionList(uuid)
              await panel.removeServerDeletionList(uuid)
              continue
            }

            let name = serverIdentifier;
            try {
              const info = await panel.getServerInfo(serverIdentifier);
              name = info.attributes.name;
            } catch (e) {  }

            console.warn(`Deleting Server with UUID of: ${uuid}`)
            await panel.deleteServer(serverId)
            await panel.removeServerDeletionList(uuid)
            await panel.removeServerSuspensionList(uuid)

            await notify(client, {
              userId,
              title: "Server Deleted",
              description: `Your server \`${name}\` was not renewed in time and has been **permanently deleted**.`,
              color: "DarkRed",
            });
          }
        }

        if (suspensionList != null) {
          let serversToSuspend = suspensionList.filter(server => {
            let { uuid, date_running_out: { date } } = server
            return currentDate >= new Date(date).setHours(0, 0, 0, 0)
          })

          for (let server of serversToSuspend) {
            let { uuid, runtime, price, user_id: userId } = server, serverId = await panel.getServerId(uuid)

            let serverIdentifier = await panel.getServerIdentifier(uuid)
            if (serverIdentifier == null) {
              await panel.removeServerSuspensionList(uuid)
              await panel.removeServerDeletionList(uuid)
              continue
            }

            let name = serverIdentifier;
            try {
              const info = await panel.getServerInfo(serverIdentifier);
              name = info.attributes.name;
            } catch (e) {  }

            console.warn(`Suspending Server with UUID of: ${uuid}`)
            await panel.suspendServer(serverId)
            await panel.addServerDeletion(uuid, runtime, userId, price)
            await panel.removeServerSuspensionList(uuid)

            const deletionInfo = await panel.getServerRuntime(serverIdentifier);
            const deletionDate = deletionInfo.status ? deletionInfo.data.deletion_date.date : null;

            await notify(client, {
              userId,
              title: "Server Suspended",
              description: `Your plan for \`${name}\` expired and the server has been **suspended**.\n` +
                `Renew with \`>plan renew ${serverIdentifier}\` before` +
                (deletionDate ? ` <t:${Math.floor(new Date(deletionDate).getTime() / 1000)}:D>` : " it's deleted") +
                ` or it will be permanently deleted.`,
              color: "Orange",
            });
          }
        }
      },
      null,
      true,
      "Europe/Amsterdam"
    );

    job.start();
  },
};
