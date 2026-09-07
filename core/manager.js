// © flux0n. All rights reserved.
﻿

const { Client } = require("discord.js");
const { UtilityCollection } = require("./utilityCollection");
const utility = new UtilityCollection();

class ManagerClient extends Client {

  async loadCommands() {
    await this.commands.clear();
    let commandsArray = [];
    const Files = await utility.loadFiles("slashCommands");
    Files.forEach((file) => {
      const command = require(file);
      this.commands.set(command.data.name, command);
      commandsArray.push(command.data.toJSON());
    });
    this.application.commands.set(commandsArray);
    return Files.length;
  }

  async loadEvents() {
    await this.events.clear();
    const Files = await utility.loadFiles("events");
    Files.forEach((file) => {
      const event = require(file);
      let execute = (...args) => event.execute(...args, this);
      this.events.set(event.name, execute);
      if (event.rest) {
        if (event.once) this.rest.on(event.name, execute);
        else this.rest.on(event.name, execute);
      } else {
        if (event.once) this.once(event.name, execute);
        else this.on(event.name, execute);
      }
    });
    return Files.length;
  }

  async loadButtons() {
    await this.buttons.clear();
    const Files = await utility.loadFiles("buttons");
    Files.forEach((file) => {
      const button = require(file);
      this.buttons.set(button.customId, button);
    });
    return Files.length;
  }

  async loadSelectMenus() {
    await this.selectMenus.clear();
    const Files = await utility.loadFiles("core/select");
    Files.forEach((file) => {
      const selectMenu = require(file);
      this.selectMenus.set(selectMenu.customId, selectMenu);
    });
    return Files.length;
  }

  async loadModals() {
    await this.modals.clear();
    const Files = await utility.loadFiles("modals");
    Files.forEach((file) => {
      const modal = require(file);
      this.modals.set(modal.customId, modal);
    });
    return Files.length;
  }

  async loadCronJobs() {
    await this.cronJobs.clear();
    const Files = await utility.loadFiles("core/cron");
    Files.forEach((file) => {
      const cronJob = require(file);
      this.cronJobs.set(cronJob.customId, cronJob);
    });
    return Files.length;
  }

  async reloadCommands() { await this.loadCommands(); }
  async reloadEvents() {
    for (let [key, value] of this.events) this.removeListener(key, value);
    await this.loadEvents();
  }
  async reloadButtons() { await this.loadButtons(); }
  async reloadSelectMenus() { await this.loadSelectMenus(); }
  async reloadModals() { await this.loadModals(); }
}

module.exports = { ManagerClient };
