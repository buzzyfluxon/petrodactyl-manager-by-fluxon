const { EmbedBuilder } = require("discord.js");
const { DataBaseInterface } = require("../dataBaseInterface");
var CronJob = require('cron').CronJob;

const database = new DataBaseInterface();

const NOTIFY_CHANNEL_ID = process.env.CLEANUP_NOTIFY_CHANNEL_ID || "1546270754033770557";
const ACTIVITY_KEY = "auto_cleanup_activity";
const WHITELIST_KEY = "purge_whitelist";
const PAID_LIST_KEY = "paid_protection_list";

const SUSPEND_AFTER_MS = (Number(process.env.AUTO_CLEANUP_SUSPEND_HOURS) || 12) * 3600000;
const DELETE_AFTER_MS = (Number(process.env.AUTO_CLEANUP_DELETE_HOURS) || 24) * 3600000;
const CHECK_SCHEDULE = process.env.AUTO_CLEANUP_CRON || "*/15 * * * *";

async function getActivity() {
  const data = await database.getObject(ACTIVITY_KEY);
  return data && typeof data === "object" ? data : {};
}

async function saveActivity(activity) {
  await database.setObject(ACTIVITY_KEY, activity);
}

async function getWhitelist() {
  const list = await database.getObject(WHITELIST_KEY);
  return Array.isArray(list) ? list : [];
}

async function getActivePaidUuids() {
  const list = await database.getObject(PAID_LIST_KEY);
  if (!Array.isArray(list)) return new Set();
  const now = Date.now();
  return new Set(list.filter((e) => now < e.protectedUntil).map((e) => e.uuid));
}

async function notify(client, { userId, title, name, identifier, reason, status, color }) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(
      `**${name}** (ID: \`${identifier}\`)\n` +
      `User: ${userId ? `<@${userId}>` : "Unknown"}  Reason:\n` +
      `\`\`\`\n${reason}\n\`\`\`\n` +
      `Status: **${status}**`
    )
    .setColor(color)
    .setFooter({ text: process.env.FOOTER_TEXT })
    .setTimestamp();

  if (userId) {
    try {
      const user = await client.users.fetch(userId);
      await user.send({ embeds: [embed] });
    } catch (error) {  }
  }

  try {
    const channel = await client.channels.fetch(NOTIFY_CHANNEL_ID);
    if (channel) {
      await channel.send({
        content: userId ? `<@${userId}>` : undefined,
        embeds: [embed],
      });
    }
  } catch (error) {
    console.error("[autoCleanup] Failed to post notify channel message:", error.message);
  }
}

module.exports = {
  customId: "autoCleanup",

  async execute(client, panel, db) {

    var job = new CronJob(
      CHECK_SCHEDULE,
      async function () {
        console.log("[autoCleanup] Scanning for inactive servers...");

        let servers;
        try {
          const res = await panel.axios.get(
            "/api/application/servers?per_page=10000&include=user",
            "application"
          );
          servers = res.data.data;
        } catch (err) {
          console.error("[autoCleanup] Failed to list servers:", err.message);
          return;
        }

        const activity = await getActivity();
        const whitelist = await getWhitelist();
        const activePaidUuids = await getActivePaidUuids();
        const now = Date.now();

        for (const server of servers) {
          const { id, uuid, identifier, name, suspended, created_at } = server.attributes;
          const entry = activity[uuid];

          if (whitelist.includes(identifier) || whitelist.includes(String(id)) || activePaidUuids.has(uuid)) {
            continue;
          }

          if (suspended) {
            if (!entry || !entry.suspendedAt) continue;

            if (now - entry.suspendedAt >= (DELETE_AFTER_MS - SUSPEND_AFTER_MS)) {
              let ownerId = null;
              try { ownerId = await panel.getUserIDfromUUID(uuid); } catch (_) {}

              try {
                await panel.deleteServer(id);
                delete activity[uuid];
                await notify(client, {
                  userId: ownerId,
                  title: "Server Deleted",
                  name,
                  identifier,
                  reason: `Server inactive for > ${DELETE_AFTER_MS / 3600000} hours (Auto-Cleanup System)`,
                  status: "Deleted",
                  color: "DarkRed",
                });
              } catch (err) {
                console.error(`[autoCleanup] Failed to delete server ${identifier}:`, err.message);
              }
            }
            continue;
          }

          if (entry && entry.suspendedAt) {
            activity[uuid] = { lastOnline: now };
            continue;
          }

          let currentState;
          try {
            const usage = await panel.liveServerRessourceUsage(identifier);
            currentState = usage.attributes.current_state;
          } catch (err) {
            console.error(`[autoCleanup] Failed to read resource usage for ${identifier}:`, err.message);
            if (!entry) {
              activity[uuid] = { lastOnline: now };
            }
            continue;
          }

          if (currentState === "running" || currentState === "starting") {
            activity[uuid] = { lastOnline: now };
            continue;
          }

          const lastOnline = entry?.lastOnline ?? new Date(created_at).getTime();
          activity[uuid] = { lastOnline };

          if (now - lastOnline >= SUSPEND_AFTER_MS) {
            let ownerId = null;
            try { ownerId = await panel.getUserIDfromUUID(uuid); } catch (_) {}

            try {
              await panel.suspendServer(id);
              activity[uuid] = { lastOnline, suspendedAt: now };
              await notify(client, {
                userId: ownerId,
                title: "Server Suspended",
                name,
                identifier,
                reason: `Server inactive for > ${SUSPEND_AFTER_MS / 3600000} hours (Auto-Cleanup System)`,
                status: "Suspended",
                color: "Orange",
              });
            } catch (err) {
              console.error(`[autoCleanup] Failed to suspend server ${identifier}:`, err.message);
            }
          }
        }

        await saveActivity(activity);
      },
      null,
      true,
      "Europe/Amsterdam"
    );

    job.start();
  },
};
