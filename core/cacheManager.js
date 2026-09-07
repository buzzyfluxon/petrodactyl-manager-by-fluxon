// © flux0n. All rights reserved.
const { DataBaseInterface } = require("./dataBaseInterface")

class CacheManager extends DataBaseInterface {
    constructor() {
        super()

        this.cacheData = async function (userId, data) {
            return await this.setObject(`${userId}Cache`, data)
        }

        this.getCachedData = async function (userId) {
            return await this.getObject(`${userId}Cache`)
        }

        this.clearCache = async function (userId) {
            return await this.deleteObject(`${userId}Cache`)
        }
    }
}

module.exports = {
    CacheManager
}
