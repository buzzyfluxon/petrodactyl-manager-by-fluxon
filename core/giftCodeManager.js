// © flux0n. All rights reserved.
const { DataBaseInterface } = require("./dataBaseInterface");

class GiftCodeManager extends DataBaseInterface {
    constructor() {
        super()

        this.createGiftCode = async function(code, value, singleUse) {
            let giftObject = {
                "code": code,
                "value": value,
                "singleUse": singleUse,
                "usedBy": []
            }
            await this.pushObject("gift_codes_list", giftObject)
        }

        this.deleteGiftCode = async function(code) {

            this.giftCodes = await this.getObject("gift_codes_list")

            this.findCode = this.giftCodes.find((obj) => obj.code == code)
            if(this.findCode == undefined) return false
            this.giftIndex = this.giftCodes.indexOf(this.findCode)

            this.giftCodes.splice(this.giftIndex, 1)
            await this.setObject("gift_codes_list", this.giftCodes)
            return true
        }

        this.addUsed = async function(userId, code) {

            this.giftCodes = await this.getObject("gift_codes_list")

            this.findCode = this.giftCodes.find((obj) => obj.code == code)
            this.giftIndex = this.giftCodes.indexOf(this.findCode)

            let usedBy = this.giftCodes[this.giftIndex].usedBy

            usedBy.push(userId)

            let giftCodeObject = {
                "code": this.giftCodes[this.giftIndex].code,
                "value": this.giftCodes[this.giftIndex].value,
                "singleUse": this.giftCodes[this.giftIndex].singleUse,
                "usedBy": usedBy
            }

            this.giftCodes[this.giftIndex] = giftCodeObject

            this.setObject("gift_codes_list", this.giftCodes)
        }
    }
}

module.exports = {
    GiftCodeManager
}
