const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { Player } = require('../../dbObjects.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setbio')
		.setDescription('Set your profile biography, creates a profile if you don\'t have one.')
		.addStringOption(option => 
            option
                .setName('bio')
                .setDescription('Your new bio (max 300 characters)')
                .setRequired(true)
                .setMaxLength(300)
                .setMinLength(1)),
                

	async execute(interaction) {
		const newBio = interaction.options.getString('bio').trim();

        if (newBio.length > 300){
            return interaction.reply({ content: 'Your bio cannot exceed 300 characters.', flags: MessageFlags.Ephemeral  });
        }

		try {
			const [player] = await Player.findOrCreate({
				where: { discordId: interaction.user.id, serverId: interaction.guildId },
				defaults: { username: interaction.user.username, serverId: interaction.guildId }
			});

			player.bio = newBio;
			await player.save();

			return interaction.reply({ content: `Your bio has been updated successfully to: **${newBio}**`, flags: MessageFlags.Ephemeral });
		} catch (error) {
			console.error('Error updating bio:', error);
			return interaction.reply({ content: 'There was an error while updating your bio.', flags: MessageFlags.Ephemeral  });
		}
	},
};
