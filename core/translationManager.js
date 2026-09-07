// © flux0n. All rights reserved.
const { DataBaseInterface } = require("./dataBaseInterface")
const database = new DataBaseInterface()
const fs = require("fs");
const defaultLanguageShort = process.env.DEFAULT_LANGUAGE

class TranslationManager {

    constructor(userId) {

        this.deleteUserLanguage = async function () {
            return await database.deleteObject(`${userId}.language`)
        }

        this.saveUserLanguage = async function (languageShort) {
            await this.deleteUserLanguage()
            return await database.setUserValue(userId, ".language", languageShort)
        }

        this.getUserLanguage = async function() {
            this.userLanguageData = await database.getObject(`${userId}`)
            switch(this.userLanguageData == null || this.userLanguageData.language == undefined) {
                case false: return this.userLanguageData.language
                case true: return defaultLanguageShort
            }
        }

        this.getTranslation = async function (key) {
            this.userLanguage = await this.getUserLanguage()
            return JSON.parse(await fs.promises.readFile(`data/translations/${this.userLanguage}.json`))[key]
        }
    }
}

module.exports = {
    TranslationManager
}
