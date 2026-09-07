// © flux0n. All rights reserved.
const { QuickDB } = require('quick.db');

class DataBaseInterface {

    constructor(filePath = "data/database/json.sqlite") {

         const database = new QuickDB({ filePath: filePath });

        this.setUser = async function (userId, eMail, userName) {
            return await database.set(userId, {
                e_mail: eMail,
                name: userName
            })
        }

        this.getObject = async function (key) {
            return await database.get(key)
        }

        this.changeUserMail = async function (userId, eMail) {
            this.userData = await this.getObject(userId)

            this.userData.e_mail = eMail
            return await database.set(userId, this.userData)
        }

        this.addShopItem = async function (type, data) {
            switch(type) {
                case "server": {
                    return await database.push("shop_items_servers", {
                        type: type,
                        data: data
                    })
                }
                default: return null
            }
        }

        this.setShop = async function (data) {
            return await database.set("shop_items_servers", data)
        }

        this.deleteUser = async function (userId) {
            return await database.delete(userId)
        }

        this.removeShopItem = async function (indexOfItem) {
            this.newShopData = await this.getObject("shop_items_servers")
            if(!this.newShopData) return null
            this.newShopData.splice(indexOfItem, 1)
            await this.setShop(this.newShopData)
        }

        this.addUserValue = async function (userId, key, value) {
            return await database.add(`${userId}${key}`, value)
        }

        this.removeUserValue = async function (userId, key, value) {
            return await database.sub(`${userId}${key}`, value)
        }

        this.setUserValue = async function (userId, key, value) {
            return await database.set(`${userId}${key}`, value)
        }

        this.fetchAll = async function () {
            return await database.all()
        }

        this.setObject = async function (key, data) {
            return await database.set(key, data)
        }

        this.pushObject = async function (key, data) {
            return await database.push(key, data)
        }

        this.deleteObject = async function(key) {
            return await database.delete(key)
        }

    }
}

module.exports = {
    DataBaseInterface
}
