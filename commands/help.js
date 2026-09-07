// © flux0n. All rights reserved.
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} = require("discord.js");

const PURPLE = 0x7c3aed;

const PAGES = {
  user: {
    title: "**User Commands**",
    body: [
      "`>user new` — Create a panel account",
      "`>user info` — View your linked account",
      "`>user profile` — View your account & server count",
      "`>user password` — Reset your panel password (sent via DM)",
      "`>user delete` — Permanently delete your panel account & servers",
    ].join("\n"),
  },
  server: {
    title: "**Server Commands**",
    body: [
      "`>server create <type> [name]` — Create a server",
      "`>server list` — List your servers",
      "`>server delete <name>` — Delete a server by name",
      "`>server protect` — Protect your servers from a purge",
      "`>server types` — Show all available server types",
      "`>status` — Live Desk Host infrastructure status",
    ].join("\n"),
  },
  limits: {
    title: "**Free Tier Limits**",
    body: [
      "RAM      256 MB",
      "Disk     512 MiB",
      "CPU      50%",
      "Slots    1 per account",
    ].map(l => `\`${l}\``).join("\n"),
  },
  admin: {
    title: "**Admin Commands**  -# Owner only",
    body: [
      "`>owner list` — List all bot owners",
      "`>owner add <@user>` — Add a bot owner",
      "`>owner remove <@user>` — Remove a bot owner",
      "`>np add <@user>` — Give a user no-prefix access",
      "`>np remove <@user>` — Remove no-prefix access",
      "`>linkaccount <@user> <email>` — Link a panel account to a user",
      "`>stats` — Full panel statistics",
      "`>admin suspend @user` — Suspend all servers of a user",
      "`>admin suspend <id>` — Suspend a server by ID",
      "`>admin unsuspend @user` — Unsuspend all servers of a user",
      "`>admin unsuspend <id>` — Unsuspend a server by ID",
      "`>admin delete @user` — Delete all servers of a user",
      "`>admin delete <id>` — Delete a server by ID",
      "`>admin servers @user` — List a user's servers",
      "`>plan create @user <type> <ram> <disk> <cpu> [days] [name]` — Create a locked-spec plan server",
      "`>plan renew <serverid> [days]` — Renew a plan, keeping remaining time",
      "`>server whitelist add|remove|list <server-id>` — Exempt a server from purges",
      "`>server purge` — Delete every unprotected, non-whitelisted server",
      "`>useonly #channel` — Restrict members to one channel for bot commands (admins bypass)",
      "`>useonly off` — Remove the channel restriction",
      "`>paid @user <plan> <server name>` — Apply a plan's specs, grant 30-day protection + role, 7-day grace period before deletion",
    ].join("\n"),
  },
};

function buildHelpContainer(page = "user") {
  const p = PAGES[page] || PAGES.user;

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("help_category_select")
    .setPlaceholder("Switch category...")
    .addOptions(
      { label: "User Commands", value: "user", description: "Account management" },
      { label: "Server Commands", value: "server", description: "Create and manage servers" },
      { label: "Free Tier", value: "limits", description: "Resource limits for free users" },
      { label: "Admin Commands", value: "admin", description: "Owner-only commands" }
    );

  return new ContainerBuilder()
    .setAccentColor(PURPLE)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("# Desk Host — Commands")
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(p.title)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(p.body)
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(1))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# Select a category below to switch.")
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(selectMenu)
    );
}

module.exports = {
  name: "help",

  async execute(message, args, client) {
    await message.reply({
      components: [buildHelpContainer("user")],
      flags: MessageFlags.IsComponentsV2,
    });
  },

  buildHelpContainer,
  PURPLE,
};
