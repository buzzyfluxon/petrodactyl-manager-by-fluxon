// © flux0n. All rights reserved.
const { Client } = require("discord.js");
const { EconomyManager } = require("../economyManager");
const { LogManager } = require("../logManager");
const logManager = new LogManager()
var CronJob = require('cron').CronJob;

module.exports = {
  customId: "dailyReset",

  async execute(client, economy) {

    var job = new CronJob(
      "0 0 0 * * *",
      async function () {

        await economy.resetAllDailyAmounts()
        await logManager.logString("The daily rewards of all users have been reset at midnight")
      },
      null,
      true,
      "Europe/Amsterdam"
    );

    job.start();
  },
};
