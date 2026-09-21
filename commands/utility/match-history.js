const { SlashCommandBuilder, EmbedBuilder, escapeMarkdown, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Player, Match } = require('../../dbObjects.js');

function formatPlacement(placement) {
	switch (placement) {
		case 1:
			return '🥇';
		case 2:
			return '🥈';
		case 3:
			return '🥉';
		default:
			return '❌';
	}
}

function formatEloChange(eloBefore, eloAfter) {
	if (eloBefore == null || eloAfter == null) {
		return '—';
	}

	const change = eloAfter - eloBefore;
	return `${change >= 0 ? '+' : ''}${change}`;
}

function formatMatchEntry(match, matchNumber) {
	const dateString = `<t:${Math.floor(match.date.getTime() / 1000)}:R>`;
	const playersText = match.Players.map((player) => {
		const userMatch = player.UserMatch;
		const placement = formatPlacement(userMatch?.placement);
		const eloBefore = userMatch?.eloBefore ?? '?';
		const eloAfter = userMatch?.eloAfter ?? '?';
		const eloChange = formatEloChange(userMatch?.eloBefore, userMatch?.eloAfter);

		return `${placement} **${escapeMarkdown(player.username)}**: ${eloBefore} → ${eloAfter} (${eloChange})`;
	}).join('\n');

	return `### Match ${matchNumber} (${match.matchType}): ${dateString}\n ${playersText}`;
}

function createEmbed(page, totalPages, pages, pageSize) {
	const pageEntries = pages[page] || [];
	const description = pageEntries.length > 0
		? pageEntries.map((entry, index) => `${entry}`).join('\n')
		: 'No matches recorded for this view.';

	return new EmbedBuilder()
		.setTitle('Complete Match History')
		.setColor('#5965ee')
		.setDescription(description)
		.setFooter({
			text: `Page ${page + 1}/${totalPages}`
		});
}

function createButtons(page, totalPages) {
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
	data: new SlashCommandBuilder()
		.setName('match-history')
		.setDescription('Display all played matches in this server.'),

	async execute(interaction) {
		await interaction.deferReply();

		try {

			const pageSize = 5;

			let	matches = await Match.findAll({
				order: [['date', 'DESC']],
				include: [{
					model: Player,
					where: { serverId: interaction.guildId },
					attributes: ['id', 'username', 'discordId'],
					through: {
						attributes: ['eloBefore', 'eloAfter', 'placement']
					}
				}]
			});
			

			if (!matches || matches.length === 0) {
				return interaction.editReply('No matches have been recorded yet.');
			}

			// TODO: Is there a batter way to do this?
			const formattedMatches = matches.map((match, index) => {
				const matchNumber = matches.length - index;
				return formatMatchEntry(match, matchNumber);
			});

			const pages = [];

			for (let i = 0; i < formattedMatches.length; i += pageSize) {
				pages.push(formattedMatches.slice(i, i + pageSize));
			}

			const currentPage = 0;
			const reply = await interaction.editReply({
				embeds: [createEmbed(currentPage, pages.length, pages, pageSize)],
				components: [createButtons(currentPage, pages.length)]
			});

			interaction.client.matchHistoryPages ??= new Map();
			interaction.client.matchHistoryPages.set(reply.id, { pages, pageSize });

			return reply;
		} catch (error) {
			console.error('Error fetching match history:', error);
			await interaction.editReply('There was an error while trying to fetch match history.');
		}
	},
};
