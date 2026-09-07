<div align="center">

<img src="assets/banner.svg" alt="Fluxon" width="100%" />

<br/>

[![Node.js](https://img.shields.io/badge/node-%3E%3D18-7c3aed?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![discord.js](https://img.shields.io/badge/discord.js-v14-7c3aed?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-f1c40f?style=for-the-badge)](LICENSE)

**A Discord bot that turns Pterodactyl Panel management into a slash away.**
Free-tier servers, paid plans, boost perks, and full admin tooling — all from Discord.

</div>

<br/>

<div align="center">
  <img src="assets/headers/features.svg" alt="Features" width="600" />
</div>

<br/><br/>

| | |
|---|---|
| <img src="assets/icons/server.svg" width="22" /> **Server Lifecycle** | Users create, view, and manage their own Pterodactyl servers with `>server` |
| <img src="assets/icons/gem.svg" width="22" /> **Paid Plans** | Fixed-tier (`>paid`) or fully custom (`>plan`) paid servers, with automatic protection & expiry |
| <img src="assets/icons/rocket.svg" width="22" /> **Booster Perks** | Automatic resource perks for server boosters |
| <img src="assets/icons/bell.svg" width="22" /> **Smart Logging** | Separate, color-coded log channels for free vs. paid server activity |
| <img src="assets/icons/broom.svg" width="22" /> **Auto Cleanup** | Inactivity detection with grace periods and DM warnings before deletion |
| <img src="assets/icons/key.svg" width="22" /> **Role-Gated Access** | Fine-grained owner / role-based permissions for sensitive commands |
| <img src="assets/icons/globe.svg" width="22" /> **Multi-language** | Built-in translation manager with several locales included |
| <img src="assets/icons/gear.svg" width="22" /> **Fully Configurable** | Every channel, role, and emoji ID lives in one `.env` file |

<br/>

<div align="center">
  <img src="assets/headers/getting-started.svg" alt="Getting Started" width="600" />
</div>

<br/><br/>

**Requirements:** Node.js 18+, a Discord bot application, and a Pterodactyl Panel with API access.

```bash
# 1. Clone the repo
git clone https://github.com/your-username/fluxon.git
cd fluxon

# 2. Install dependencies
npm install

# 3. Configure your environment
cp .env.example config.env
# then fill in config.env with your bot token, panel URL/keys, and IDs

# 4. Run the bot
npm start
