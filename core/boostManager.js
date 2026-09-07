// © flux0n. All rights reserved.
const { DataBaseInterface } = require("./dataBaseInterface")

class BoostManager extends DataBaseInterface {
    constructor() {
        super()

        this.getBoostCount = async function (userId) {
            this.userData = await this.getObject(userId)
            if (!this.userData) return 0
            let { boost_count } = this.userData
            return boost_count || 0
        }

        this.setBoostCount = async function (userId, count) {
            return await this.setUserValue(userId, ".boost_count", count)
        }

        this.wasSuspendedByBoostLoss = async function (userId) {
            this.userData = await this.getObject(userId)
            if (!this.userData) return false
            let { boost_suspended } = this.userData
            return !!boost_suspended
        }

        this.setSuspendedByBoostLoss = async function (userId, value) {
            return await this.setUserValue(userId, ".boost_suspended", value)
        }
    }
}

module.exports = {
    BoostManager
}
