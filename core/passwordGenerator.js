// © flux0n. All rights reserved.
const crypto = require('crypto');

class Password {

    constructor() {
        this.generatePassword = async function (length = 16) {

            if (
                typeof length !== 'number'
                || length <= 0
                || length == null
                || length == void 0
                || length == NaN
            ) return "";

            let password = "";

            let characterSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{};:,.<>?/|~`";

            length = Math.floor(length);

            for(let i = 0; i < length; i++) {
                const idx = crypto.randomInt(0, characterSet.length);
                password += characterSet.charAt(idx)
            }

            return password
        }
    }
}

module.exports = {
    Password,
}
