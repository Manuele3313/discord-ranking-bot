const { Events, Collection, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function buildHistoryEmbed(page, totalPages, pages) {
	const pageEntries = pages[page] || [];
	const description = pageEntries.length > 0
		? pageEntries.join('\n')
		: 'No matches recorded for this view.';

	return new EmbedBuilder()
		.setTitle('Complete Match History')
		.setColor('#5965ee')
		.setDescription(description)
		.setFooter({ text: `Page ${page + 1}/${totalPages}` });
}

function buildHistoryButtons(page, totalPages) {
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`match-history:first:${0}`)
			.setLabel('First')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page === 0),
		new ButtonBuilder()
			.setCustomId(`match-history:previous:${page}`)
			.setLabel('⬅ Previous')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page === 0),
		new ButtonBuilder()
			.setCustomId(`match-history:next:${page}`)
			.setLabel('Next ➡')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page === totalPages - 1),
		new ButtonBuilder()
			.setCustomId(`match-history:last:${totalPages}`)
			.setLabel('Last')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page === totalPages - 1),
	);
}

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (interaction.isButton() && interaction.customId.startsWith('match-history:')) {
			const [_, action, pageValue] = interaction.customId.split(':');
			const currentPage = Number(pageValue || 0);
			const historyState = interaction.client.matchHistoryPages?.get(interaction.message?.id);

			if (!historyState) {
				return interaction.reply({
					content: 'This match history message is no longer available. Please run the `/match-history` command again.',
					flags: MessageFlags.Ephemeral,
				});
			}

			const targetPage = action === 'next'
				? Math.min(currentPage + 1, historyState.pages.length - 1)
				: Math.max(currentPage - 1, 0);

			await interaction.update({
				embeds: [buildHistoryEmbed(targetPage, historyState.pages.length, historyState.pages)],
				components: [buildHistoryButtons(targetPage, historyState.pages.length)]
			});
			return;
		}

		// Update Match-History when a new match is recorded
		// if (interaction.isChatInputCommand() && interaction.commandName === 'record-match') {
		// 	const historyState = interaction.client.matchHistoryPages?.get(interaction.message?.id);
		// 	if (!historyState) {
		// 		console.log('No match history state found to update.');
		// 	}

		// 	await interaction.update({
		// 		embeds: [buildHistoryEmbed(0, historyState.pages.length, historyState.pages)],
		// 		components: [buildHistoryButtons(0, historyState.pages.length)]
		// 	});

		// }

		if (!interaction.isChatInputCommand()) return;

		const command = interaction.client.commands.get(interaction.commandName);
		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}

		try {
            // Cooldowns
            const { cooldowns } = interaction.client;

            if (!cooldowns.has(command.data.name)) {
                cooldowns.set(command.data.name, new Collection());
            }

            const now = Date.now();
            const timestamps = cooldowns.get(command.data.name);
            const defaultCooldownDuration = 3;
            const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1_000;

            if (timestamps.has(interaction.user.id)) {
                const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

                if (now < expirationTime) {
                    const expiredTimestamp = Math.round(expirationTime / 1_000);
                    return interaction.reply({
                        content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
            }

            timestamps.set(interaction.user.id, now);
            setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
            await command.execute(interaction);
            
		} catch (error) {
			console.error(error);
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({
					content: 'There was an error while executing this command!',
					flags: MessageFlags.Ephemeral,
				});
			} else {
				await interaction.reply({
					content: 'There was an error while executing this command!',
					flags: MessageFlags.Ephemeral,
				});
			}
		}
	},
};

