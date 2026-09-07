// © flux0n. All rights reserved.
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SectionBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const { PanelManager } = require("../core/panelManager");
const { DataBaseInterface } = require("../core/dataBaseInterface");
const { Password } = require("../core/passwordGenerator");

const panel = new PanelManager(
  process.env.PTERODACTYL_API_URL,
  process.env.PTERODACTYL_API_KEY,
  process.env.PTERODACTYL_ACCOUNT_API_KEY
);
const db = new DataBaseInterface();
const PURPLE = 0x7c3aed;
const RED = 0xe74c3c;
const GREEN = 0x2ecc71;

function container(...components) {
  const c = new ContainerBuilder().setAccentColor(PURPLE);
  for (const comp of components) c.addTextDisplayComponents(comp);
  return c;
}

module.exports = {
  name: "user",

  async execute(message, args) {
    const subcommand = args[0];

    if (!subcommand || subcommand === "help") {
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(PURPLE)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("# User Commands")
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "`>user new` — Create your panel account\n" +
                "`>user info` — View your linked account\n" +
                "`>user profile` — View your account & server count\n" +
                "`>user password` — Reset your panel password (sent via DM)\n" +
                "`>user delete` — Permanently delete your panel account & servers"
              )
            )
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (subcommand === "new") {
      const userId = message.author.id;
      const sanitizedBase = message.author.username
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "_")
        .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
        .substring(0, 16)
        .replace(/[^a-z0-9]+$/g, "");
      const username = sanitizedBase.length >= 3
        ? sanitizedBase
        : `user${userId.slice(-8)}`;
      const email = `${username}_${userId.slice(-4)}@deskhost.fun`;

      const existing = await db.getObject(userId);
      if (existing) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("# Already Registered")
              )
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `You already have a panel account linked.\n\nEmail  \`${existing.e_mail}\`\nUsername  \`${existing.name}\``
                )
              )
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const panelUser = await panel.checkAccount(email);
      if (panelUser) {
        await db.setUser(userId, email, username);
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("# Account Re-linked")
              )
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `Your existing panel account has been re-linked.\n\nEmail  \`${email}\``
                )
              )
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const password = await new Password().generatePassword(12);
      const firstName = message.author.username
        .replace(/[^\p{L}\p{N} '.-]/gu, "")
        .trim()
        .substring(0, 191) || username;

      try {
        await panel.addUser(email, username, firstName, "User", password);
        await db.setUser(userId, email, username);

        try {
          await message.author.send({
            components: [
              new ContainerBuilder()
                .setAccentColor(PURPLE)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("# Your Panel Credentials")
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    "Keep these safe — do not share them.\n\n" +
                    `Panel  \`${process.env.PTERODACTYL_API_URL}\`\n` +
                    `Email  \`${email}\`\n` +
                    `Password  \`${password}\``
                  )
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
                .addSectionComponents(
                  new SectionBuilder()
                    .addTextDisplayComponents(
                      new TextDisplayBuilder().setContent("-# Login with the credentials above.")
                    )
                    .setButtonAccessory(
                      new ButtonBuilder()
                        .setLabel("Open Panel")
                        .setStyle(ButtonStyle.Link)
                        .setURL(process.env.PTERODACTYL_API_URL)
                    )
                )
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        } catch (_) {  }

        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("# Account Created")
              )
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# ${userId}`)
              )
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  "Your account is ready — check your **DMs** for your panel login details."
                )
              )
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addSectionComponents(
                new SectionBuilder()
                  .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`-# ${process.env.FOOTER_TEXT}`)
                  )
                  .setButtonAccessory(
                    new ButtonBuilder()
                      .setLabel("Open Panel")
                      .setStyle(ButtonStyle.Link)
                      .setURL(process.env.PTERODACTYL_API_URL)
                  )
              )
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (err) {
        const apiErrors = err && err.response && err.response.data && err.response.data.errors;
        console.error("[user new] Error:", err.response ? JSON.stringify(err.response.data, null, 2) : err);

        let detail;
        if (Array.isArray(apiErrors) && apiErrors.length) {
          detail = apiErrors
            .map(e => `${e.meta && e.meta.source_field ? `${e.meta.source_field}: ` : ""}${e.detail || e.code}`)
            .join("\n");
        } else if (err.response && err.response.status === 403) {
          detail = "The Application API key does not have permission to create users. Check the key's role in the panel's Application API settings.";
        } else {
          detail = err.message;
        }

        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0xe74c3c)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("# Account Creation Failed")
              )
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`\`\`\`\n${detail}\n\`\`\``)
              )
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (subcommand === "info") {
      const userId = message.author.id;
      const userData = await db.getObject(userId);
      if (!userData) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("# No Account Found")
              )
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  "You don't have a panel account yet.\nRun `>user new` to create one."
                )
              )
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const panelUser = await panel.checkAccount(userData.e_mail);
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(PURPLE)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("# Your Account")
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `Email  \`${userData.e_mail}\`\n` +
                `Username  \`${userData.name}\`\n` +
                `Status  \`${panelUser ? "Active" : "Not found on panel"}\``
              )
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addSectionComponents(
              new SectionBuilder()
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`-# ${process.env.FOOTER_TEXT}`)
                )
                .setButtonAccessory(
                  new ButtonBuilder()
                    .setLabel("Open Panel")
                    .setStyle(ButtonStyle.Link)
                    .setURL(process.env.PTERODACTYL_API_URL)
                )
            )
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (subcommand === "profile") {
      const userId = message.author.id;
      const userData = await db.getObject(userId);
      if (!userData) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("# No Account Found")
              )
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  "You don't have a panel account yet.\nRun `>user new` to create one."
                )
              )
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const panelUser = await panel.checkAccount(userData.e_mail);
      const servers = panelUser
        ? panelUser.attributes.relationships.servers.data
        : null;

      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(PURPLE)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("# Your Profile")
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `Email  \`${userData.e_mail}\`\n` +
                `Username  \`${userData.name}\`\n` +
                `Status  \`${panelUser ? "Active" : "Not found on panel"}\`\n` +
                `Servers  \`${servers ? servers.length : 0}\``
              )
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addSectionComponents(
              new SectionBuilder()
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`-# ${process.env.FOOTER_TEXT}`)
                )
                .setButtonAccessory(
                  new ButtonBuilder()
                    .setLabel("Open Panel")
                    .setStyle(ButtonStyle.Link)
                    .setURL(process.env.PTERODACTYL_API_URL)
                )
            )
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (subcommand === "password") {
      const userId = message.author.id;
      const userData = await db.getObject(userId);
      if (!userData) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("# No Account Found")
              )
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  "You don't have a panel account yet.\nRun `>user new` to create one."
                )
              )
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      try {
        const result = await panel.resetUserPassword(userData.e_mail);

        try {
          await message.author.send({
            components: [
              new ContainerBuilder()
                .setAccentColor(PURPLE)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("# Your Panel Password Was Reset")
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    "Keep this safe — do not share it.\n\n" +
                    `Panel  \`${process.env.PTERODACTYL_API_URL}\`\n` +
                    `Email  \`${userData.e_mail}\`\n` +
                    `New Password  \`${result.passkey}\``
                  )
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
                .addSectionComponents(
                  new SectionBuilder()
                    .addTextDisplayComponents(
                      new TextDisplayBuilder().setContent("-# Login with the credentials above.")
                    )
                    .setButtonAccessory(
                      new ButtonBuilder()
                        .setLabel("Open Panel")
                        .setStyle(ButtonStyle.Link)
                        .setURL(process.env.PTERODACTYL_API_URL)
                    )
                )
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        } catch (_) {
          return message.reply({
            components: [
              new ContainerBuilder()
                .setAccentColor(RED)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("# Password Reset, But DM Failed")
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    "Your panel password was reset, but I couldn't DM you the new one.\n" +
                    "Enable DMs from server members and run `>user password` again to get a new one sent."
                  )
                )
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(GREEN)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("# Password Reset")
              )
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  "Your new panel password has been sent to your **DMs**."
                )
              )
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (err) {
        console.error("[user password] Error:", err);
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(RED)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("# Password Reset Failed")
              )
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `\`\`\`\n${err.message}\n\`\`\``
                )
              )
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (subcommand === "delete") {
      const userId = message.author.id;
      const userData = await db.getObject(userId);
      if (!userData) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("# No Account Found")
              )
              .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  "You don't have a panel account yet.\nRun `>user new` to create one."
                )
              )
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const panelUser = await panel.checkAccount(userData.e_mail);
      const serverCount = panelUser
        ? panelUser.attributes.relationships.servers.data.length
        : 0;

      const confirmId = `user_delete_confirm_${userId}`;
      const cancelId = `user_delete_cancel_${userId}`;

      const prompt = await message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(RED)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("# Delete Your Panel Account?")
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "This will **permanently** delete your panel account " +
                `and all \`${serverCount}\` server(s) on it.\n\n` +
                "**This cannot be undone.** You have 30 seconds to confirm."
              )
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(confirmId)
                  .setLabel("Delete Everything")
                  .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                  .setCustomId(cancelId)
                  .setLabel("Cancel")
                  .setStyle(ButtonStyle.Secondary)
              )
            )
        ],
        flags: MessageFlags.IsComponentsV2,
      });

      const collector = prompt.createMessageComponentCollector({
        filter: (i) => i.user.id === userId,
        time: 30000,
        max: 1,
      });

      collector.on("collect", async (interaction) => {
        if (interaction.customId === cancelId) {
          return interaction.update({
            components: [
              new ContainerBuilder()
                .setAccentColor(PURPLE)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("# Deletion Cancelled")
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("Your account was left untouched.")
                )
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        await interaction.update({
          components: [
            new ContainerBuilder()
              .setAccentColor(PURPLE)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("# Deleting…")
              )
          ],
          flags: MessageFlags.IsComponentsV2,
        });

        try {
          await panel.deleteAllServers(userData.e_mail);
          await panel.removeUser(userData.e_mail);
          await db.deleteUser(userId);

          await interaction.editReply({
            components: [
              new ContainerBuilder()
                .setAccentColor(GREEN)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("# Account Deleted")
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    "Your panel account and all of its servers have been permanently deleted."
                  )
                )
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        } catch (err) {
          console.error("[user delete] Error:", err);
          await interaction.editReply({
            components: [
              new ContainerBuilder()
                .setAccentColor(RED)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("# Deletion Failed")
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    `\`\`\`\n${err.message}\n\`\`\``
                  )
                )
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        }
      });

      collector.on("end", async (collected) => {
        if (collected.size === 0) {
          try {
            await prompt.edit({
              components: [
                new ContainerBuilder()
                  .setAccentColor(PURPLE)
                  .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("# Deletion Timed Out")
                  )
                  .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
                  .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("No response received — your account was left untouched.")
                  )
              ],
              flags: MessageFlags.IsComponentsV2,
            });
          } catch (_) {}
        }
      });

      return;
    }

    return message.reply({ content: `Unknown subcommand. Try \`>user new\`, \`>user info\`, \`>user profile\`, \`>user password\`, or \`>user delete\`` });
  }
};
