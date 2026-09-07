// © flux0n. All rights reserved.
const c = {
	reset: '\x1b[0m',
	bold: '\x1b[1m',
	dim: '\x1b[2m',
	cyan: '\x1b[36m',
	magenta: '\x1b[35m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	gray: '\x1b[90m'
};

function printBanner() {
	const version = require('./package.json').version || '1.0.0';
	const lines = [
		'',
		`${c.magenta}${c.bold}  _____ _                              ${c.reset}`,
		`${c.magenta}${c.bold} |  ___| |_   ___  __ ___  _ __  ${c.reset}`,
		`${c.magenta}${c.bold} | |_  | | | | \\ \\/ / _ \\| '_ \\ ${c.reset}`,
		`${c.magenta}${c.bold} |  _| | | |_| |>  < (_) | | | |${c.reset}`,
		`${c.magenta}${c.bold} |_|   |_|\\__,_/_/\\_\\___/|_| |_|${c.reset}`,
		'',
		`${c.gray}────────────────────────────────────────${c.reset}`,
		`${c.cyan}${c.bold} made by fluxon${c.reset}`,
		`${c.gray}────────────────────────────────────────${c.reset}`,
		`${c.dim} node   ${c.reset}${process.version}`,
		`${c.dim} env    ${c.reset}${process.env.DEFAULT_LANGUAGE || 'en-US'}`,
		`${c.dim} status ${c.reset}${c.yellow}starting...${c.reset}`,
		''
	];
	console.log(lines.join('\n'));
}

function printReady(client) {
	console.log(`${c.green}${c.bold}✔ Bot is online${c.reset} ${c.dim}as${c.reset} ${c.bold}${client.user.tag}${c.reset}`);
	console.log(`${c.gray}────────────────────────────────────────${c.reset}`);
}

module.exports = { printBanner, printReady };
