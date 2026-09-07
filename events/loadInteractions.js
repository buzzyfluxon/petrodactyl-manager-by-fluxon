const { EconomyManager } = require("../core/economyManager");
const { PanelManager } = require("../core/panelManager");
const { DataBaseInterface } = require("../core/dataBaseInterface");
const { EmojiManager } = require("../core/emojiManager");
const { ActivityType } = require("discord.js");
const statusCommand = require("../commands/status");
const fs = require("fs");

const database = new DataBaseInterface();
const panel = new PanelManager(process.env.PTERODACTYL_API_URL, process.env.PTERODACTYL_API_KEY, process.env.PTERODACTYL_ACCOUNT_API_KEY);
const emojiManager = new EmojiManager();

module.exports = {
  name: "clientReady",
  once: false,

  async execute(client) {

    const cmds    = await client.loadCommands();
    const btns    = await client.loadButtons();
    const selects = await client.loadSelectMenus();
    const modals  = await client.loadModals();
    const crons   = await client.loadCronJobs();

    const eventsCount = fs.readdirSync("./events").filter(f => f.endsWith(".js")).length;
    const prefixCount = fs.readdirSync("./commands").filter(f => f.endsWith(".js")).length;

    let cronJob = client.cronJobs.get("dailyReset");
    if (cronJob) await cronJob.execute(client, new EconomyManager());

    cronJob = client.cronJobs.get("dailyRuntime");
    if (cronJob) await cronJob.execute(client, panel, database, emojiManager);

    cronJob = client.cronJobs.get("autoCleanup");
    if (cronJob) await cronJob.execute(client, panel, database);

    cronJob = client.cronJobs.get("paidProtection");
    if (cronJob) await cronJob.execute(client, panel, database);

    await statusCommand.resumeAll(client);

    const PURPLE = "\x1b[38;2;124;58;237m";
    const RESET = "\x1b[0m";
    const GRAY = "\x1b[90m";

    console.clear();

    const banner = `
${PURPLE}  ███████╗██╗     ██╗   ██╗██╗  ██╗ ██████╗ ███╗   ██╗
${PURPLE}  ██╔════╝██║     ██║   ██║╚██╗██╔╝██╔═══██╗████╗  ██║
${PURPLE}  █████╗  ██║     ██║   ██║ ╚███╔╝ ██║   ██║██╔██╗ ██║
${PURPLE}  ██╔══╝  ██║     ██║   ██║ ██╔██╗ ██║   ██║██║╚██╗██║
${PURPLE}  ██║     ███████╗╚██████╔╝██╔╝ ██╗╚██████╔╝██║ ╚████║
${PURPLE}  ╚═╝     ╚══════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝${RESET}

${GRAY}======================================================${RESET}
  Logged in as:  ${PURPLE}${client.user.tag}${RESET}
  Ping:          ${PURPLE}${Math.round(client.ws.ping)}ms${RESET}
  Servers:       ${PURPLE}${client.guilds.cache.size}${RESET}
${GRAY}======================================================${RESET}
  ${PURPLE}✓${RESET} Prefix Cmds  : ${prefixCount}
  ${PURPLE}✓${RESET} Slash Cmds   : ${cmds}
  ${PURPLE}✓${RESET} Events       : ${eventsCount}
  ${PURPLE}✓${RESET} Components   : ${btns + selects + modals}
  ${PURPLE}✓${RESET} Tasks        : ${crons}
${GRAY}======================================================${RESET}
${PURPLE}>> DeskHost System Online and Ready.${RESET}
`;

    console.log(banner);

    const statuses = [
      { name: ">help | desk", type: ActivityType.Streaming, url: "https://twitch.tv/fluxon" },
      { name: "Watching {servers} servers", type: ActivityType.Streaming, url: "https://twitch.tv/fluxon" },
      { name: "free host", type: ActivityType.Streaming, url: "https://twitch.tv/fluxon" },
      { name: "fluxon is goat", type: ActivityType.Streaming, url: "https://twitch.tv/fluxon" }
    ];

    let statusIndex = 0;
    setInterval(() => {
      let currentStatus = statuses[statusIndex];
      let name = currentStatus.name.replace("{servers}", client.guilds.cache.size);

      client.user.setActivity(name, {
        type: currentStatus.type,
        url: currentStatus.url
      });

      statusIndex = (statusIndex + 1) % statuses.length;
    }, 15000);
  },
};
