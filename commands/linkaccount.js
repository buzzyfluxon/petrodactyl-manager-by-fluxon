// © flux0n. All rights reserved.
﻿

const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require("discord.js");
const { OwnerManager } = require("../core/ownerManager");
const { PanelManager } = require("../core/panelManager");
const { DataBaseInterface } = require("../core/dataBaseInterface");

const ownerMgr = new OwnerManager();
const db = new DataBaseInterface();
const panel = new PanelManager(
  process.env.PTERODACTYL_API_URL,
  process.env.PTERODACTYL_API_KEY,
  process.env.PTERODACTYL_ACCOUNT_API_KEY
);

const PURPLE = 0x7c3aed;

module.exports = {
  name: "linkaccount",

  async execute(message, args, client) {
    if (!(await ownerMgr.isOwner(message.author.id))) {
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(PURPLE)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Access Denied"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("This command is restricted to bot owners."))
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const targetArg = args[0];
    const email = args[1];

    if (!targetArg || !email) {
      return message.reply("Usage: `>linkaccount <@user or ID> <email>`");
    }

    const targetId = targetArg.replace(/[<@!>]/g, "");
    if (!/^\d+$/.test(targetId)) {
      return message.reply("Please mention a user or provide a valid Discord ID.");
    }

    let targetUser;
    try {
      targetUser = await client.users.fetch(targetId);
    } catch (e) {
      return message.reply("Invalid Discord User ID or the user could not be fetched.");
    }

    const loading = await message.reply({ content: "Processing link..." });

    try {

      const panelUser = await panel.checkAccount(email);
      if (!panelUser) {
        return loading.edit({
          content: null,
          components: [
            new ContainerBuilder()
              .setAccentColor(0xe74c3c)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Account Not Found"))
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`No Pterodactyl account found with the email \`${email}\`.`))
          ],
          flags: MessageFlags.IsComponentsV2
        });
      }

      const resetResult = await panel.resetUserPassword(email);
      const newPassword = resetResult.passkey;
      const username = panelUser.attributes.username;

      await db.setUser(targetUser.id, email, username);

      let dmStatus = "✅ Credentials delivered to user via DM.";
      try {
        await targetUser.send({
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Account Linked & Secured"))
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `Your Discord account has been linked to your Pterodactyl panel account by an administrator.\n\n` +
                `For security, a new strong password has been generated for you. Do not share these credentials.\n\n` +
                `Panel URL: \`${process.env.PTERODACTYL_API_URL}\`\n` +
                `Email: \`${email}\`\n` +
                `Username: \`${username}\`\n` +
                `Password: \`${newPassword}\``
              ))
          ],
          flags: MessageFlags.IsComponentsV2
        });
      } catch (e) {
        dmStatus = "⚠️ Failed to DM user. They may have DMs disabled.";
      }

      const servers = await panel.getAllServers(email);

      const responseContainer = new ContainerBuilder()
        .setAccentColor(PURPLE)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Account Linked Successfully"))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# User: <@${targetUser.id}> • Email: ${email}`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(dmStatus));

      if (!servers || servers.length === 0) {
        responseContainer
          .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent("**Linked Servers:**\nNone. This user has no servers on the panel."));
      } else {
        const serverLines = servers.map((s, i) =>
          `**${i + 1}.** \`${s.attributes.name}\` (ID: \`${s.attributes.identifier}\`) - Status: \`${s.attributes.status || "active"}\``
        ).join("\n");

        responseContainer
          .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Linked Servers (${servers.length}):**\n${serverLines}`));
      }

      return loading.edit({
        content: null,
        components: [responseContainer],
        flags: MessageFlags.IsComponentsV2
      });

    } catch (error) {
      console.error("[linkaccount] Error:", error);
      return loading.edit({
        content: null,
        components: [
          new ContainerBuilder()
            .setAccentColor(0xe74c3c)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Error Linking Account"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`An API error occurred:\n\`\`\`\n${error.message}\n\`\`\``))
        ],
        flags: MessageFlags.IsComponentsV2
      });
    }
  }
};
