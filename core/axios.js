// © flux0n. All rights reserved.
const { AxiosDataGenerator } = require("./axiosDataGenerator");
const axiosParam = require("axios");

class Axios {

  constructor(axiosInstance, baseLink, applicationAuthKey, clientAuthKey) {

    this.applicationConfigGenerator = new AxiosDataGenerator(applicationAuthKey);
    this.applicationConfig = this.applicationConfigGenerator.generateConfig();

    this.clientConfigGenerator = new AxiosDataGenerator(clientAuthKey);
    this.clientConfig = this.clientConfigGenerator.generateConfig();

    this.get = async function (linkExtension, type) {
      switch (type) {
        case `application`:
          return await axiosInstance.get(
            `${baseLink}${linkExtension}`,
            this.applicationConfig
          );
        case `client`: {
          return await axiosInstance.get(
            `${baseLink}${linkExtension}`,
            this.clientConfig
          );
        }
        default:
          return null;
      }
    };

    this.post = async function (linkExtension, data, type) {
      switch (type) {
        case `application`:
          return await axiosInstance.post(
            `${baseLink}${linkExtension}`,
            data,
            this.applicationConfig
          );
        case `client`: {
          return await axiosInstance.post(
            `${baseLink}${linkExtension}`,
            data,
            this.clientConfig
          );
        }
        default:
          return null;
      }
    };

    this.delete = async function (linkExtension, type) {
      switch (type) {
        case `application`:
          return await axiosInstance.delete(
            `${baseLink}${linkExtension}`,
            this.applicationConfig
          );
        case `client`: {
          return await axiosInstance.delete(
            `${baseLink}${linkExtension}`,
            this.clientConfig
          );
        }
        default:
          return null;
      }
    };

    this.patch = async function (linkExtension, data, type) {
      switch (type) {
        case `application`:
          return await axiosInstance.patch(
            `${baseLink}${linkExtension}`,
            data,
            this.applicationConfig
          );
        case `client`: {
          return await axiosInstance.patch(
            `${baseLink}${linkExtension}`,
            data,
            this.clientConfig
          );
        }
        default:
          return null;
      }
    };
  }
}

module.exports = {
  Axios,
};
