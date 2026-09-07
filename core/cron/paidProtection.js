// © flux0n. All rights reserved.
const { EmbedBuilder } = require("discord.js");
const { DataBaseInterface } = require("../dataBaseInterface");
const { getPlan } = require("../paidPlans");
var CronJob = require('cron').CronJob;

const database = new DataBaseInterface();

const NOTIFY_CHANNEL_ID = process.env.NOTIFY_CHANNEL_ID || "1546108683656761404";

const PAID_LIST_KEY = "paid_protection_list";
const PAID_ROLE_ID = process.env.PAID_ROLE_ID || "1546364478369701899";
const GRACE_DAYS = 7;
const GRACE_MS = GRACE_DAYS * 86400000;

async function getPaidList() {
  const list = await database.getObject(PAID_LIST_KEY);
  return Array.isArray(list) ? list : [];
}

async function savePaidList(list) {
  await database.setObject(PAID_LIST_KEY, list);
}

async function notify(client, { userId, title, description, color }) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setFooter({ text: process.env.FOOTER_TEXT })
    .setTimestamp();

  if (userId) {
    try {
      const user = await client.users.fetch(userId);
      await user.send({ embeds: [embed] });
    } catch (_) {  }
  }

  try {
    const channel = await client.channels.fetch(NOTIFY_CHANNEL_ID);
    if (channel) {
      await channel.send({ content: userId ? `<@${userId}>` : undefined, embeds: [embed] });
    }
  } catch (err) {
    console.error("[paidProtection] Failed to post notify channel message:", err.message);
  }
}

module.exports = {
  customId: "paidProtection",

  async execute(client, panel, db) {

    var job = new CronJob(
      "0 0 0 * * *",
      async function () {
        console.log("[paidProtection] Checking paid-protected servers...");

        const list = await getPaidList();
        const now = Date.now();
        const remaining = [];

        for (const entry of list) {
          const { uuid, identifier, userId, guildId, protectedUntil, plan: planKey } = entry;
          const planInfo = planKey ? getPlan(planKey) : null;
          const planLabel = planInfo ? planInfo.label : "your";

          let serverIdentifier;
          try {
            serverIdentifier = await panel.getServerIdentifier(uuid);
          } catch (_) {
            serverIdentifier = null;
          }

          if (!serverIdentifier) {
            continue;
          }

          let name = serverIdentifier;
          try {
            const info = await panel.getServerInfo(serverIdentifier);
            name = info.attributes.name;
          } catch (_) {  }

          if (now < protectedUntil) {
            remaining.push(entry);
            continue;
          }

          const graceEnd = protectedUntil + GRACE_MS;

          if (now >= graceEnd) {
            try {
              const info = await panel.getServerInfo(serverIdentifier);
              await panel.deleteServer(info.attributes.id);
            } catch (err) {
              console.error(`[paidProtection] Failed to delete server ${serverIdentifier}:`, err.message);
              remaining.push(entry);
              continue;
            }

            if (guildId && userId) {
              try {
                const guild = await client.guilds.fetch(guildId);
                const member = await guild.members.fetch(userId);
                await member.roles.remove(PAID_ROLE_ID);
              } catch (_) {  }
            }

            await notify(client, {
              userId,
              title: "Server Deleted",
              description: `Your ${planLabel} plan protection for \`${name}\` was not renewed within the ${GRACE_DAYS}-day grace period, so it has been **permanently deleted**.`,
              color: "DarkRed",
            });

            continue;
          }

          const daysLeft = Math.ceil((graceEnd - now) / 86400000);
          await notify(client, {
            userId,
            title: "Renew Your Paid Protection",
            description: `Your ${planLabel} plan protection for \`${name}\` has expired. It will be **permanently deleted in ${daysLeft} day${daysLeft === 1 ? "" : "s"}** ` +
              `unless renewed — purchase a renewal and have an admin run \`>paid <@${userId}> ${planKey || "<plan>"} ${name}\` again.`,
            color: "Orange",
          });

          remaining.push(entry);
        }

        await savePaidList(remaining);
      },
      null,
      true,
      "Europe/Amsterdam"
    );

    job.start();
  },
};
