// © flux0n. All rights reserved.
const { DataBaseInterface } = require("./dataBaseInterface")

class EconomyManager extends DataBaseInterface {
    constructor() {
        super()

        this.addCoins = async function (userId, amount) {
            return await this.addUserValue(userId, ".balance", amount)
        }

        this.setCoins = async function (userId, value) {
            return await this.setUserValue(userId, ".balance", value)
        }

        this.removeCoins = async function (userId, amount) {
            return await this.removeUserValue(userId, ".balance", amount)
        }

        this.getUserBalance = async function (userId) {
            this.userData = await this.getObject(userId)
            if (this.userData == null) return null
            return this.userData.balance
        }

        this.getTotalCoinAmount = async function () {
            this.entireDatabase = await this.fetchAll()
            this.totalCoinAmount = 0
            for (let object of this.entireDatabase) {
                let { value: { balance } } = object
                if (object) if (balance != undefined) this.totalCoinAmount += balance
            }
            return this.totalCoinAmount
        }

        this.getTopUsers = async function () {
            this.userDatabase = await this.fetchAll()
            await this.userDatabase.sort(function (a, b) { if (a.value.balance == undefined) return -Infinity; return a.value.balance - b.value.balance })
            this.userDatabase = this.userDatabase.filter(user => {
                if (!user.value?.balance) return false;
                return true;
            });
            return this.userDatabase
        }

        this.addDailyAmount = async function (userId, amount) {
            return await this.addUserValue(userId, ".daily", amount)
        }

        this.setDailyAmount = async function (userId, value) {
            return await this.setUserValue(userId, ".daily", value)
        }

        this.removeDailyAmount = async function (userId, amount) {
            return await this.removeUserValue(userId, ".daily", amount)
        }

        this.getUserDaily = async function (userId) {
            this.userData = await this.getObject(userId)
            return this.userData.daily
        }

        this.resetAllDailyAmounts = async function () {
            this.entireDatabase = await this.fetchAll()
            for (let object of this.entireDatabase) {
                let { value: { daily }, id } = object
                if (daily) await this.setDailyAmount(id, 0)
            }
        }

    }
}

module.exports = {
    EconomyManager
}
