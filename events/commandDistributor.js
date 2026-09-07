// © flux0n. All rights reserved.
const { BaseInteraction, Client } = require("discord.js")
const { PanelManager } = require("../core/panelManager")
const { BoosterManager } = require("./../core/boosterManager")
const { CacheManager } = require("./../core/cacheManager")
const { EconomyManager } = require("./../core/economyManager")
const { LogManager } = require("./../core/logManager")
const { DataBaseInterface } = require("./../core/dataBaseInterface")
const { TranslationManager } = require("./../core/translationManager")
const { GiftCodeManager } = require("./../core/giftCodeManager")
const { EmojiManager } = require("./../core/emojiManager")

const database = new DataBaseInterface()
const boosterManager = new BoosterManager()
const cacheManager = new CacheManager()
const economyManager = new EconomyManager()
const logManager = new LogManager()
const giftCodeManager = new GiftCodeManager()
const emojiManager = new EmojiManager();
const panel = new PanelManager(process.env.PTERODACTYL_API_URL, process.env.PTERODACTYL_API_KEY, process.env.PTERODACTYL_ACCOUNT_API_KEY)

module.exports = {
    name: "interactionCreate",
    once: false,

    async execute(interaction, client) {
        if (!interaction.inGuild()) return;
        let translationManager = new TranslationManager(interaction.user.id)
        const t = async function (key) {
            return await translationManager.getTranslation(key)
        }

        if (interaction.isCommand()) {
            let command = client.commands.get(interaction.commandName);
            try {
                await command.execute(interaction, client, panel, boosterManager, cacheManager, economyManager, logManager, database, t, giftCodeManager, emojiManager);
            } catch (error) {
                console.error(`Command "${command.customId}" failed: ${error}`)
            }

        } else if (interaction.isButton()) {

            if (["A", "B", "C", "D"].includes(interaction.customId)) return;

            if(["overrideFalse", "overrideTrue"].includes(interaction.customId)) return;

            let button = client.buttons.get(interaction.customId);
            try {
                await button.execute(interaction, client, panel, boosterManager, cacheManager, economyManager, logManager, database, t, giftCodeManager, emojiManager);
            } catch (error) {
                console.error(`Button "${button.customId}" failed: ${error}`);
            }

        } else if (interaction.isStringSelectMenu()) {

            if (["singleUseCodeSelect"].includes(interaction.customId)) return;
            let selectMenu = client.selectMenus.get(interaction.customId);
            try {
                await selectMenu.execute(interaction, client, panel, boosterManager, cacheManager, economyManager, logManager, database, t, giftCodeManager, emojiManager);
            } catch (error) {
                console.log(`Select Menu "${selectMenu.customId}" failed: ${error}`);
            }

        } else if (interaction.isModalSubmit()) {
            let modal = client.modals.get(interaction.customId);
            try {
            await modal.execute(interaction, client, panel, boosterManager, cacheManager, economyManager, logManager, database, t, giftCodeManager, emojiManager);
            } catch(error) {
                console.log(`Modal "${modal.customId}" failed: ${error}`)
            }
        }
    }
}
