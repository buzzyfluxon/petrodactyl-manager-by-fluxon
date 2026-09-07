// © flux0n. All rights reserved.
﻿

const { DataBaseInterface } = require("./dataBaseInterface");
const db = new DataBaseInterface();
const DB_KEY = "no_prefix_users";

class NoPrefixManager {

  async getUsers() {
    const list = await db.getObject(DB_KEY);
    return Array.isArray(list) ? list : [];
  }

  async isAllowed(userId) {
    const list = await this.getUsers();
    return list.includes(String(userId));
  }

  async add(userId) {
    const list = await this.getUsers();
    if (list.includes(String(userId))) return false;
    list.push(String(userId));
    await db.setObject(DB_KEY, list);
    return true;
  }

  async remove(userId) {
    const list = await this.getUsers();
    const idx = list.indexOf(String(userId));
    if (idx === -1) return false;
    list.splice(idx, 1);
    await db.setObject(DB_KEY, list);
    return true;
  }
}

module.exports = { NoPrefixManager };
