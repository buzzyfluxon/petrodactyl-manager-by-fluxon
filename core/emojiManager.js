// © flux0n. All rights reserved.
const fs = require("fs");

class EmojiManager {

    constructor() {
        this.getEmoji = async function (key) {
            const txt = await fs.promises.readFile(`data/translations/emojis.json`);
            const json = JSON.parse(txt);
            const entry = json[key];
            if (!entry) return null;
            if (entry.id && String(entry.id).trim().length) return entry.id;
            return entry.emoji ?? null;
        }

        this.parseEmoji = function (raw) {
            if (!raw) return null;
            if (typeof raw === "string") {
                const m = raw.match(/<a?:([^:>]+):(\d+)>/);
                if (m) return { id: m[2], name: m[1], animated: raw.startsWith("<a:") };
                return raw;
            } else if (typeof raw === "object" && raw.id) {
                return { id: raw.id, name: raw.name || undefined, animated: !!raw.animated };
            }
            return null;
        }
    }
}

module.exports = {
    EmojiManager
}
