// © flux0n. All rights reserved.
const fs = require("fs");

class LogManager {

    constructor() {

        this.getLogTimestamp = async function () {
            this.currentDate = new Date()
            return `[${this.currentDate.getFullYear()}-${("0" + (this.currentDate.getMonth() + 1)).slice(-2)}-${("0" + this.currentDate.getDate()).slice(-2)} ${this.currentDate.getHours()}:${this.currentDate.getMinutes()}:${this.currentDate.getSeconds()} UTC+${(this.currentDate.getTimezoneOffset() /60) * -1}]`
        }

        this.checkForLogFile = async function () {
            await fs.promises.readFile(`./../log/log.txt`)
            .then(async () => {
                return true
            })
            .catch(async () => {
                return false
            })
        }

        this.createLogFile = async function () {
            await fs.promises.appendFile(`./../log/log.txt`, "")
            .then(async () => {
                return true
            })
            .catch(async () => {
                return false
            })
        }

        this.logString = async function (data = new String) {
            this.timestamp = await this.getLogTimestamp()
            await fs.promises.appendFile(`log/log.txt`, `${this.timestamp} ${data} \n`, function (e) {})
        }
    }
}

module.exports = {
    LogManager
}
