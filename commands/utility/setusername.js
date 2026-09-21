const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { Player } = require('../../dbObjects.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setusername')
		.setDescription('Set your displayed username, creates a profile if you don\'t have one.')
		.addStringOption(option => 
            option
                .setName('username')
                .setDescription('Your new bio (max 75 characters)')
                .setRequired(true)
                .setMaxLength(75)
                .setMinLength(1)),
                

	async execute(interaction) {
		const newUsername = interaction.options.getString('username').trim();

        if (newUsername.length > 75){
            return interaction.reply({ content: 'Your username cannot exceed 75 characters.', flags: MessageFlags.Ephemeral  });
        }

		try {
			const [player] = await Player.findOrCreate({
				where: { discordId: interaction.user.id, serverId: interaction.guildId },
				defaults: { username: interaction.user.username, serverId: interaction.guildId }
			});

			player.username = newUsername;
			await player.save();

			return interaction.reply({ content: `Your username has been updated successfully to: **${newUsername}**`, flags: MessageFlags.Ephemeral });
		} catch (error) {
			console.error('Error updating bio:', error);
			return interaction.reply({ content: 'There was an error while updating your username.', flags: MessageFlags.Ephemeral  });
		}
	},
};
