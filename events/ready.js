const { Events } = require('discord.js');

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		// const storedBalances = await Users.findAll(); 
		// storedBalances.forEach((b) => client.currency.set(b.user_id, b));

		console.log(`Ready! Logged in as ${client.user.tag}`);
	},
};

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
