// © flux0n. All rights reserved.
﻿

const { DataBaseInterface } = require("./dataBaseInterface");
const db = new DataBaseInterface();
const DB_KEY = "bot_owner_list";

class OwnerManager {

  async getOwners() {
    let owners = await db.getObject(DB_KEY);
    if (!owners || !Array.isArray(owners)) {

      const seed = (process.env.OWNER_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
      owners = seed;
      await db.setObject(DB_KEY, owners);
    }
    return owners;
  }

  async isOwner(userId) {
    const owners = await this.getOwners();
    return owners.includes(String(userId));
  }

  async addOwner(userId) {
    const owners = await this.getOwners();
    if (owners.includes(String(userId))) return false;
    owners.push(String(userId));
    await db.setObject(DB_KEY, owners);
    return true;
  }

  async removeOwner(userId) {
    const owners = await this.getOwners();
    const idx = owners.indexOf(String(userId));
    if (idx === -1) return false;
    owners.splice(idx, 1);
    await db.setObject(DB_KEY, owners);
    return true;
  }
}

module.exports = { OwnerManager };
