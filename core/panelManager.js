// © flux0n. All rights reserved.
const { Axios } = require("./axios");
const { Password } = require("./passwordGenerator");
const { DataBaseInterface } = require("./dataBaseInterface");
const axiosInstance = require("axios");
const database = new DataBaseInterface();
const serverDeletionOffset = process.env.DELETION_OFFSET;
class PanelManager {

  constructor(link, apiKey, accountKey) {
    this.axios = new Axios(axiosInstance, link, apiKey, accountKey);

    this._withRetries = async function (fn, maxAttempts = 3) {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await fn();
        } catch (e) {
          const statusCode = e && e.response && e.response.status;
          if ((statusCode === 504 || statusCode === 502 || statusCode === 503) && attempt < maxAttempts) {

            await new Promise((r) => setTimeout(r, attempt * 1000));
            continue;
          }
          throw e;
        }
      }
    };

    this.checkAccount = async function (eMail) {
      this.userData;
      this.userDataObject = await this.axios.get(
        `/api/application/users?filter[email]=${eMail}&include=servers&per_page=10000`,
        "application"
      );
      this.userData = this.userDataObject.data.data.find(user => user.attributes.email == eMail)
      return this.userData;
    };

    this.addUser = async function (
      eMail,
      username,
      firstName,
      lastName,
      passkey
    ) {
      passkey
        ? (this.password = passkey)
        : (this.password = await new Password().generatePassword(10));
      return await this.axios.post(
        `/api/application/users`,
        {
          email: eMail,
          username: username,
          first_name: firstName,
          last_name: lastName,
          password: this.password,
        },
        "application"
      )
    };

    this.removeUser = async function (eMail) {
      this.userAccountData = await this.checkAccount(eMail);
      if (!this.userAccountData) return
      this.user = this.userAccountData.attributes.id;
      return await this.axios.delete(
        `/api/application/users/${this.user}`,
        "application"
      );
    };

    this.resetUserPassword = async function (eMail, passkey) {
      passkey
        ? (this.password = passkey)
        : (this.password = await new Password().generatePassword(15));
      this.userAccountData = await this.checkAccount(eMail);
      this.userData = this.userAccountData.attributes;
      let { username, first_name, last_name } = this.userData
      let awaitAxiosData = await this.axios.patch(
        `/api/application/users/${this.userData.id}`,
        {
          email: eMail,
          username: username,
          first_name: first_name,
          last_name: last_name,
          password: this.password,
        },
        "application"
      );
      return {
        data: awaitAxiosData,
        passkey: this.password
      }
    };

    this.getPanelNodes = async function () {
      let nodeArray = new Array();
      this.nodeData = await this.axios.get(
        `/api/application/nodes?per_page=10000&include=servers`,
        "application"
      );
      nodeArray = this.nodeData.data.data.map(node => node)
      return nodeArray;
    };

    this.getAllocations = async function (nodeId) {
      this.allocationData = await this.axios.get(
        `/api/application/nodes/${nodeId}/allocations?per_page=10000`,
        "application"
      );
      return this.allocationData.data.data;
    };

    this.getNestData = async function (eggId) {
      this.nestData = await this.axios.get(
        `/api/application/nests?per_page=10000&include=eggs`,
        "application"
      );
      return this.nestData.data.data;
    };

    this.getEggData = async function (eggId, nestId) {
      this.eggData = await this.axios.get(
        `/api/application/nests/${nestId}/eggs/${eggId}?per_page=10000&include=config,script,variables`,
        "application"
      );
      return this.eggData.data;
    };

    this.createServer = async function (eMail, serverName, eggId, memoryAmount, swapAmount, diskAmount, ioValue, cpuPercentage, databaseAmount, backupAmount) {

      this.userData = await this._withRetries(() => this.checkAccount(eMail));
      if (!this.userData) throw new Error(`Panel createServer: user not found for email=${eMail}`);

      this.nodeData = await this._withRetries(() => this.getPanelNodes());
      if (!this.nodeData || !Array.isArray(this.nodeData) || this.nodeData.length === 0) throw new Error(`Panel createServer: no node data returned from panel`);

      this.nodeServerAmount = this.nodeData.map(node => node.attributes.relationships.servers.data.length);

      this.lowestNode = this.nodeData[this.nodeServerAmount.indexOf(Math.min(...this.nodeServerAmount))];
      if (!this.lowestNode) throw new Error(`Panel createServer: could not determine lowestNode from nodeData`);

      this.allocations = await this._withRetries(() => this.getAllocations(this.lowestNode.attributes.id));
      if (!this.allocations || !Array.isArray(this.allocations)) throw new Error(`Panel createServer: no allocations returned for node ${this.lowestNode && this.lowestNode.attributes && this.lowestNode.attributes.id}`);

      this.freeAllocations = this.allocations.filter(allocation => allocation.attributes.assigned == false)
      this.freeAllocationIds = this.freeAllocations.map(allocation => allocation.attributes.id)
      if (!this.freeAllocationIds || this.freeAllocationIds.length === 0) throw new Error(`Panel createServer: no free allocations available on node ${this.lowestNode && this.lowestNode.attributes && this.lowestNode.attributes.id}`);

      this.nestData = await this.getNestData();

      this.chosenNestData = this.nestData.find(nest => nest.attributes.relationships.eggs.data.some(egg => egg.attributes.id == eggId))
      if (!this.chosenNestData) throw new Error(`Panel createServer: chosenNestData not found for eggId=${eggId}`);
      this.chosenEggData = this.chosenNestData.attributes.relationships.eggs.data.find(egg => egg.attributes.id == eggId)
      if (!this.chosenEggData) throw new Error(`Panel createServer: chosenEggData not found for eggId=${eggId}`);

      this.complexEggData = await this._withRetries(() => this.getEggData(
        eggId,
        this.chosenEggData.attributes.nest
      ));
      if (!this.complexEggData) throw new Error(`Panel createServer: complexEggData missing for eggId=${eggId}`);
      this.enviromentVariables =
        this.complexEggData.attributes.relationships.variables.data;
      this.populatedEnviromentVariables = new Object();
      for (let variable of this.enviromentVariables) {

        if (variable.attributes.rules.includes("required"))
          this.populatedEnviromentVariables[
            variable.attributes.env_variable
          ] = variable.attributes.default_value;
      }

      return await this._withRetries(() => this.axios.post(
        `/api/application/servers`,
        {
          name: serverName,
          user: this.userData.attributes.id,
          egg: eggId,
          docker_image: this.complexEggData.attributes.docker_image,
          startup: this.chosenEggData.attributes.startup,
          environment: this.populatedEnviromentVariables,
          limits: {
            memory: memoryAmount,
            swap: swapAmount,
            disk: diskAmount,
            io: ioValue,
            cpu: cpuPercentage,
          },
          feature_limits: {
            databases: databaseAmount,
            backups: backupAmount,
          },
          allocation: {
            default: this.freeAllocationIds[Math.floor(Math.random() * this.freeAllocationIds.length)]
          },
        },
        "application"
      ));
    };

    this.deleteServer = async function (serverId) {
      this.responseData = await this.axios.delete(
        `/api/application/servers/${serverId}`,
        "application"
      );
      return this.responseData.data;
    };

    this.getAllServers = async function (eMail) {
      this.userData = await this.checkAccount(eMail);
      return this.userData ? this.userData.attributes.relationships.servers.data : null;
    };

    this.getInstallStatus = async function (serverIdentifier) {
      try {
        this.serverUsage = await this.axios.get(`/api/client/servers/${serverIdentifier}/resources`, "client")
        return true
      } catch (e) { return false }
    }

    this.liveServerRessourceUsage = async function (serverId) {
      this.serverUsage = await this.axios.get(
        `/api/client/servers/${serverId}/resources`,
        "client"
      );
      return this.serverUsage.data;
    };

    this.getServerInfo = async function (serverIdentifier) {
      this.serverData = await this.axios.get(
        `/api/client/servers/${serverIdentifier}`,
        "client"
      );
      return this.serverData.data;
    };

    this.powerEventServer = async function (serverIdentifier, type) {
      this.responseData = await this.axios.post(
        `/api/client/servers/${serverIdentifier}/power`,
        {
          signal: type,
        },
        "client"
      );
      return this.responseData.data;
    };

    this.reinstallServer = async function (serverIdentifier) {
      this.responseData = await this.axios.post(
        `/api/client/servers/${serverIdentifier}/settings/reinstall`,
        {},
        "client"
      );
      return this.responseData.data;
    };

    this.renameServer = async function (serverIdentifier, newName) {
      this.responseData = await this.axios.post(
        `/api/client/servers/${serverIdentifier}/settings/rename`,
        {
          name: newName,
        },
        "client"
      );
      return this.responseData.data;
    };

    this.getServerId = async function (uuid) {
      this.responseData = await this.axios.get(
        `/api/application/servers?per_page=10000`, "application"
      );
      this.serverData = this.responseData.data.data.find(server => server.attributes.uuid == uuid)
      if (!this.serverData) return null
      let { attributes: { id } } = this.serverData
      return id;
    };

    this.getServerIdentifier = async function (uuid) {
      this.responseData = await this.axios.get(
        `/api/application/servers?per_page=10000`, "application"
      );
      this.serverData = this.responseData.data.data.find(server => server.attributes.uuid == uuid)
      if (!this.serverData) return null
      let { attributes: { identifier } } = this.serverData
      return identifier;
    };

    this.suspendServer = async function (serverId) {
      this.responseData = await this.axios.post(
        `/api/application/servers/${serverId}/suspend`,
        {},
        "application"
      );
      return this.responseData.data;
    };

    this.unSuspendServer = async function (serverId) {
      this.responseData = await this.axios.post(
        `/api/application/servers/${serverId}/unsuspend`,
        {},
        "application"
      );
      return this.responseData.data;
    };

    this.getServerDetails = async function (serverId) {
      this.responseData = await this.axios.get(
        `/api/application/servers/${serverId}`,
        "application"
      );
      return this.responseData.data;
    };

    this.updateServerLimits = async function (serverId, memoryAmount, cpuPercentage) {
      this.currentServer = await this._withRetries(() => this.getServerDetails(serverId));
      let { limits, feature_limits, allocation } = this.currentServer.attributes;
      this.responseData = await this._withRetries(() => this.axios.patch(
        `/api/application/servers/${serverId}/build`,
        {
          allocation: allocation,
          memory: memoryAmount,
          swap: limits.swap,
          disk: limits.disk,
          io: limits.io,
          cpu: cpuPercentage,
          feature_limits: feature_limits,
        },
        "application"
      ));
      return this.responseData.data;
    };

    this.setServerRuntime = async function (
      serverUuid,
      runtime,
      userId,
      serverPrice
    ) {
      this.runtimeObject = {
        uuid: serverUuid,
        user_id: userId,
        runtime: runtime,
        price: serverPrice,
        date_created: {
          date: new Date(),
        },
        date_running_out: {
          date: new Date(new Date().getTime() + runtime * 86400000),
        },
      };
      return await database.pushObject(
        "runtime_server_list",
        this.runtimeObject
      );
    };

    this.setRuntimeList = async function (data) {
      return await database.setObject("runtime_server_list", data);
    };

    this.getRuntimeList = async function () {
      this.list = await database.getObject("runtime_server_list");
      if (!this.list) return null
      return this.list
    };

    this.removeServerSuspensionList = async function (serverUuid) {
      this.runtimeList = await this.getRuntimeList();
      this.newRuntimeList = this.runtimeList.filter(server => server.uuid != serverUuid)
      await this.setRuntimeList(this.newRuntimeList);
    };

    this.addServerDeletion = async function (serverUuid, runtime, userId, serverPrice) {
      this.runtimeList = await this.getRuntimeList();
      this.selectedServer = this.runtimeList.find(server => server.uuid == serverUuid)
      let { date_running_out, date_created } = this.selectedServer
      return await database.pushObject("delete_server_list", {
        uuid: serverUuid,
        user_id: userId,
        runtime: runtime,
        price: serverPrice,
        date_created: date_created,
        deletion_date: {
          date: new Date(
            new Date(date_running_out.date).getTime() +
            serverDeletionOffset * 86400000
          ),
        }
      });
    }

    this.setDeletionList = async function (data) {
      return await database.setObject("delete_server_list", data);
    };

    this.getDeletionList = async function () {
      this.list = await database.getObject("delete_server_list");
      if (!this.list) return null
      return this.list
    };

    this.removeServerDeletionList = async function (serverUuid) {
      this.deletionList = await this.getDeletionList();
      if (!this.deletionList) return null
      this.newDeletionList = this.deletionList.filter(server => server.uuid != serverUuid)
      await this.setDeletionList(this.newDeletionList);
    };

    this.getServerRuntime = async function (serverIdentifier) {
      this.serverData = await this.getServerInfo(serverIdentifier);
      this.serverUuid = this.serverData.attributes.uuid;

      this.runtimeList = await this.getRuntimeList();
      this.deletionList = await this.getDeletionList();

      if (this.runtimeList != null) {
        for (let server of this.runtimeList)
          if (server.uuid == this.serverUuid)
            return {
              status: true,
              type: "suspension",
              data: server,
            };
      }

      if (this.deletionList != null) {
        for (let server of this.deletionList)
          if (server.uuid == this.serverUuid)
            return {
              status: true,
              type: "deletion",
              data: server,
            };
      }

      return {
        status: false,
        type: "error",
      };
    };

    this.extendRuntime = async function (serverIdentifier, runtimeExtension) {
      this.suspensionList = await this.getRuntimeList();
      this.deletionList = await this.getDeletionList();
      this.serverData = await this.getServerInfo(serverIdentifier);
      this.serverUuid = this.serverData.attributes.uuid;

      for (let server of this.suspensionList || [])
        if (server.uuid == this.serverUuid) {
          await this.removeServerSuspensionList(this.serverUuid);
          return await database.pushObject("runtime_server_list", {
            uuid: this.serverUuid,
            user_id: server.user_id,
            runtime: server.runtime,
            price: server.price,
            date_created: server.date_created,
            date_running_out: {
              date: new Date(
                new Date(
                  server.date_running_out.date
                ).getTime() +
                runtimeExtension * 86400000
              ),
            },
          });
        }

      for (let server of this.deletionList || [])
        if (server.uuid == this.serverUuid) {
          await this.removeServerDeletionList(this.serverUuid);
          return await database.pushObject("runtime_server_list", {
            uuid: this.serverUuid,
            user_id: server.user_id,
            runtime: server.runtime,
            price: server.price,
            date_created: server.date_created,
            date_running_out: {
              date: new Date(
                new Date(server.deletion_date.date).getTime() +
                runtimeExtension * 86400000
              ),
            },
          });
        }
    };

    this.deleteAllServers = async function (eMail) {
      this.userServers = await this.getAllServers(eMail);
      if (!this.userServers || this.userServers.length == 0) return
      for (let server of this.userServers) {
        await this.deleteServer(server.attributes.id);
        try {
          await this.removeServerSuspensionList(
            server.attributes.uuid
          );
          await this.removeServerDeletionList(
            server.attributes.uuid
          );
        } catch (e) { }
      }
    };

    this.getAccumulatedUserServers = async function () {
      this.database = await database.fetchAll()
      this.users = this.database.filter((object) => {
        if (object.id.length == 18) return true
      }).map(user => user.value.e_mail)

      let allServers = await this.axios.get("/api/application/servers?per_page=10000&include=user", "application")
      this.serverList = []

      for (let i = 0; i < allServers.data.data.length; i++) {
        if (this.users
          .includes(allServers.data.data[i].attributes.relationships.user.attributes.email)) {
          this.serverList.push(allServers.data.data[i].attributes.uuid)
        }
      }

      return this.serverList ?? null

    }

    this.getUserIDfromUUID = async function (uuid) {
      this.database = await database.fetchAll()
      this.users = this.database.filter((object) => {
        if (object.id.length == 18) return true
      })
      this.userEmails = this.users.map(user => user.value.e_mail)

      this.serverId = await this.getServerId(uuid)
      let server = await this.axios.get(`/api/application/servers/${this.serverId}?include=user`, "application")

      let email = server.data.attributes.relationships.user.attributes.email

      let index = this.userEmails.indexOf(email)

      let id = this.users[index].id

      return id
    }

    this.getUserEmailFromAPIKey = async function (key) {
      this.database = await database.fetchAll()
      this.users = this.database.filter((object) => {
        if (object.id.length == 18) return true
      })

      this.userEmails = this.users.map(user => user.value.e_mail)

      let accountData = null;
      let tempAxios = new Axios(axiosInstance, link, apiKey, key);
      try {
        accountData = await tempAxios.get(`/api/client/account`, "client")
      } catch (e) {
        return null;
      }
      if (!accountData) return null;
      let eMail = accountData.data.attributes.email;
      if (!eMail) return null;
      return eMail;
    }

    this.checkLocalAccount = async function (eMail) {
      if (!eMail) return false;
      const normalizedEmail = String(eMail).toLowerCase();
      this.database = await database.fetchAll();
      if (!Array.isArray(this.database) || this.database.length === 0) return false;

      const users = this.database.filter((obj) => obj && obj.id && String(obj.id).length === 18);

      const found = users.find((u) => u.value && u.value.e_mail && String(u.value.e_mail).toLowerCase() === normalizedEmail);
      return !!found;
    };

  }
}

module.exports = {
  PanelManager,
};
