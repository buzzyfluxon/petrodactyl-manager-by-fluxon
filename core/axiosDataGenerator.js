// © flux0n. All rights reserved.
const http = require("http");
const https = require("https");

class AxiosDataGenerator {

  constructor(authKey, defaults = {}) {
    this.generateConfig = function (overrides = {}) {
      const base = {
        timeout: defaults.timeout ?? 15000,
        httpAgent: defaults.httpAgent ?? new http.Agent({ keepAlive: true }),
        httpsAgent: defaults.httpsAgent ?? new https.Agent({ keepAlive: true }),
        ...defaults,
      };

      const cfg = { ...base, ...overrides };

      cfg.headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(defaults.headers || {}),
        ...(overrides.headers || {}),
        Authorization: `Bearer ${authKey}`,
      };

      return cfg;
    };
  }
}

module.exports = {
  AxiosDataGenerator,
};
