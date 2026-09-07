// © flux0n. All rights reserved.
const dotenv = require('dotenv');
const { printBanner, printReady } = require('./banner');

dotenv.config({
	path: './config.env'
})

printBanner();

const {
	GatewayIntentBits,
	Partials,
	Collection
} = require('discord.js');

const { ManagerClient } = require("./core/manager")

const client = new ManagerClient({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
	partials: [Partials.Channel, Partials.User, Partials.GuildMember, Partials.ThreadMember]
});

const token = process.env.BOT_TOKEN

client.commands = new Collection()
client.events = new Collection()
client.buttons = new Collection()
client.selectMenus = new Collection()
client.modals = new Collection()
client.cronJobs = new Collection()

client.loadEvents()

client.once('clientReady', () => printReady(client));

client.login(token);
