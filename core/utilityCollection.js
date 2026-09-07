// © flux0n. All rights reserved.
let { Password } = require("./passwordGenerator");
const { glob } = require("glob");

class UtilityCollection {

    constructor() {

        this.generatePassword = async function (length) {
            return new Password().generatePassword(length)
        }

        this.getRandomInteger = async function (max) {
            return Math.floor(Math.random() * max)
        }

        this.roundUp = async function (number, precision) {
            this.roundPrecision = Math.pow(10, precision)
            return Math.ceil(number * this.roundPrecision) / this.roundPrecision
        }

        this.loadFiles = async function (directoryName) {
            this.files = await glob(`${process.cwd().replace(/\\/g, "/")}/${directoryName}/**/*.js`)
            this.files.forEach((file) => delete require.cache[require.resolve(file)])
            return this.files
        }
    }
}

module.exports = {
    UtilityCollection
}
