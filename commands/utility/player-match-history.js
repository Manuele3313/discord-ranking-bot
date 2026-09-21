const { SlashCommandBuilder, EmbedBuilder, escapeMarkdown } = require('discord.js');
const { Player, Match } = require('../../dbObjects.js');
const { Op, fn, col, where } = require('sequelize');

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

function formatMatchEntry(match) {
	const dateString = `<t:${Math.floor(match.date.getTime() / 1000)}:R>`;
	const playersText = match.Players.map((player) => {
		const userMatch = player.UserMatch;
		const placement = formatPlacement(userMatch?.placement);
		const eloBefore = userMatch?.eloBefore ?? '?';
		const eloAfter = userMatch?.eloAfter ?? '?';
		const eloChange = formatEloChange(userMatch?.eloBefore, userMatch?.eloAfter);

		return `${placement} **${escapeMarkdown(player.username)}**: ${eloBefore} → ${eloAfter} (${eloChange})`;
	}).join('\n');

	return `### Match (${match.matchType}): ${dateString}\n ${playersText}`;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('player-match-history')
		.setDescription('Display the last 5 matches played by the specified player(s).')
		.addUserOption(option => option.setName('player').setDescription('The player to display matches for').setRequired(true))
		.addUserOption(option => option.setName('player2').setDescription('Second player').setRequired(false))
		.addUserOption(option => option.setName('player3').setDescription('Third player').setRequired(false))
		.addUserOption(option => option.setName('player4').setDescription('Fourth player').setRequired(false)),

	async execute(interaction) {
		await interaction.deferReply();

		try {

			// Use Set to avoid duplicate
			const selectedUsers = [...new Set(['player', 'player2', 'player3', 'player4']
				.map((player) => interaction.options.getUser(player))
				.filter(Boolean))];
			
			if (selectedUsers.length === 0) {
				return interaction.editReply('Please select at least one player.');
			}

			const playerIds = (selectedUsers.map((user) => user.id));

			// Find match IDs that have all specified players
			const matchIds = await Match.findAll({
				attributes: ['id'],
				include: [
					{
						model: Player,
						attributes: [],
						through: {
							attributes: []
						},
						where: {
							discordId: {
								[Op.in]: playerIds
							},
							serverId: interaction.guildId
						}
					}
				],
				group: ['Match.id'],
				having: where(fn('COUNT', col('Players.id')), {
					[Op.gte]: playerIds.length
				}),
				raw: true
			}).then(matches => matches.map(m => m.id));

			if (matchIds.length === 0) {
				return interaction.editReply('No matches found.');
			}

			// Fetch the complete matches with ALL players
			let matches = await Match.findAll({
				where: {
					id: {
						[Op.in]: matchIds
					}
				},
				order: [['date', 'DESC']],
				include: [
					{
						model: Player,
						attributes: ['id', 'username', 'discordId'],
						through: {
							attributes: ['eloBefore', 'eloAfter', 'placement']
						}
					}
				]
			});

			if (!matches || matches.length === 0) {
				return interaction.editReply('No matches found.');
			}

			let match_data = {
				// The number of won matches is stored in the object, with a property for each player Id.
				matchesWon : {},
				totalMatches : matches.length,
				"2p": 0,
				"3p": 0,
				"4p": 0
			}

			// Map for playerId -> playerIdDatabase
			const playerMap = new Map();

			// Add object properties
			for (const playerId of playerIds) {
				const player = await Player.findOne({
					where: {
						discordId: playerId,
						serverId: interaction.guildId
					}
				});
				const playerIdDatabase = player.id;
				playerMap.set(playerId, playerIdDatabase);
				match_data.matchesWon[playerIdDatabase] = 0;
			}

			matches.forEach((match) => {
				match_data[match.matchType]++
				if(match_data.matchesWon[`${match.winnerId}`] !== undefined){
					match_data.matchesWon[`${match.winnerId}`]++
				}
			})

			let winrateMessage = "";
			for (const user of selectedUsers) {
				winrateMessage += `**${escapeMarkdown(user.username)}**: ${match_data.matchesWon[playerMap.get(user.id)]} wins (${Math.round((match_data.matchesWon[playerMap.get(user.id)] / match_data.totalMatches) * 100)}%)\n`;
			}

			let matchTypeMessage = `**2 Players:** ${match_data["2p"]} (${Math.round((match_data["2p"] / match_data.totalMatches) * 100)}%)\n**3 Players:** ${match_data["3p"]} (${Math.round((match_data["3p"] / match_data.totalMatches) * 100)}%)\n**4 Players:** ${match_data["4p"]} (${Math.round((match_data["4p"] / match_data.totalMatches) * 100)}%)`;

			// Display only the last 5 matches to not go above the embed character limit.
			matches = matches.slice(0, 5);
			const formattedMatches = matches.map((match, index) => {
				const matchNumber = matches.length - index;
				return formatMatchEntry(match);
			});

			const embed = new EmbedBuilder()
                .setColor('#5965ee')
                .setTitle(`Match History of ${selectedUsers.map(user => escapeMarkdown(user.username)).join(', ')}`)
				.addFields(
					{ name: 'Win Rate', value: winrateMessage, inline: true },
					{ name: 'Match Types', value: matchTypeMessage, inline: true },
					{ name: 'Total Matches', value: `${match_data.totalMatches}`}
				)
				.setFooter({ text: 'Brought to you by John Arcana' })
				.setDescription(formattedMatches.join('\n'))

            return interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('Error fetching match history:', error);
			await interaction.editReply('There was an error while trying to fetch match history.');
		}
	},
};
