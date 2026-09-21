const { SlashCommandBuilder, EmbedBuilder, escapeMarkdown } = require('discord.js');
const { sequelize, Player, Match } = require('../../dbObjects.js');
const { Op } = require('sequelize');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('record-match-undo')
        .setDescription('Undo the outcome of the last recorded match.'),

	async execute(interaction) {
        await interaction.deferReply();
        const t = await sequelize.transaction();

        const buildErrorEmbed = (title, description) => new EmbedBuilder()
            .setColor('#ec4454')
            .setTitle(title)
            .setDescription(description);

        const computeStreaks = (matches, playerId) => {
            let currentWinStreak = 0;
            let currentLossStreak = 0;
            let maxWinStreak = 0;
            let maxLossStreak = 0;
            let streakType = null;
            let streakCount = 0;

            for (const match of matches) {
                const won = match.winnerId === playerId;
                const result = won ? 'win' : 'loss';

                if (streakType === null || result === streakType) {
                    streakCount += 1;
                } else {
                    if (streakType === 'win') {
                        maxWinStreak = Math.max(maxWinStreak, streakCount);
                    } else {
                        maxLossStreak = Math.max(maxLossStreak, streakCount);
                    }
                    streakCount = 1;
                }

                streakType = result;
                if (result === 'win') {
                    maxWinStreak = Math.max(maxWinStreak, streakCount);
                } else {
                    maxLossStreak = Math.max(maxLossStreak, streakCount);
                }
            }

            if (matches.length > 0) {
                const firstWon = matches[0].winnerId === playerId;
                if (firstWon) {
                    currentWinStreak = 1;
                    for (let i = 1; i < matches.length; i++) {
                        const won = matches[i].winnerId === playerId;
                        if (won) currentWinStreak += 1;
                        else break;
                    }
                } else {
                    currentLossStreak = 1;
                    for (let i = 1; i < matches.length; i++) {
                        const won = matches[i].winnerId === playerId;
                        if (!won) currentLossStreak += 1;
                        else break;
                    }
                }
            }

            return { currentWinStreak, currentLossStreak, maxWinStreak, maxLossStreak };
        };

        try {
            const lastMatch = await Match.findOne({
                where: { serverId: interaction.guildId },
                include: [{
                    model: Player,
                    through: { attributes: ['eloBefore', 'eloAfter', 'placement'] },
                    attributes: ['id', 'discordId', 'username']
                }],
                order: [['date', 'DESC'], ['id', 'DESC']],
                transaction: t
            });

            if (!lastMatch) {
                await t.rollback();
                const errorEmbed = buildErrorEmbed('No Match Found', 'No match found to undo. Please ensure a match has been recorded before attempting to undo.');
                return interaction.editReply({ embeds: [errorEmbed] });
            }

            if (!lastMatch.Players || lastMatch.Players.length === 0) {
                await t.rollback();
                const errorEmbed = buildErrorEmbed('Invalid Match Data', 'The last match has no associated players. Unable to undo.');
                return interaction.editReply({ embeds: [errorEmbed] });
            }

            const participantIds = lastMatch.Players.map(player => player.id);
            const winnerId = lastMatch.winnerId;

            const playersInMatch = await Player.findAll({
                where: { id: participantIds },
                transaction: t
            });

            const matchType = lastMatch.matchType;

            for (const player of playersInMatch) {
                const userMatch = lastMatch.Players.find(p => p.id === player.id)?.UserMatch;
                if (!userMatch) {
                    throw new Error(`Missing UserMatch record for player ${player.id} in match ${lastMatch.id}`);
                }

                // Restore elo to pre-match value
                player.currentElo = userMatch.eloBefore;

                if (player.id === winnerId) {
                    await player.decrement(['matchesPlayedTotal', 'matchesWonTotal', `matchesPlayed${matchType}`, `matchesWon${matchType}`], { transaction: t });
                } else {
                    await player.decrement(['matchesPlayedTotal', `matchesPlayed${matchType}`], { transaction: t });
                }
            }

            // Recalculate current streaks and max streaks based on remaining matches.
            for (const player of playersInMatch) {
                const playerMatches = await player.getMatches({
                    where: {
                        serverId: interaction.guildId,
                        id: { [Op.ne]: lastMatch.id }
                    },
                    order: [['createdAt', 'DESC']],
                    transaction: t
                });

                const streaks = computeStreaks(playerMatches, player.id);
                player.currentWinStreak = streaks.currentWinStreak;
                player.currentLossStreak = streaks.currentLossStreak;
                player.maxWinStreak = streaks.maxWinStreak;
                player.maxLossStreak = streaks.maxLossStreak;
                await player.save({ transaction: t });
            }

            const message = lastMatch.Players.map(player => {
                // EloAfter and EloBefore are swapped due to the undo.
                const userMatch = player.UserMatch;
                let placement = '';
                switch (userMatch.placement) {
                    case 1:
                        placement = '🥇';
                        break;
                    case 2:
                        placement = '🥈';
                        break;
                    case 3:
                        placement = '🥉';
                        break;
                    default:
                        placement = '❌';
                }
                const sign = userMatch.eloBefore - userMatch.eloAfter > 0 ? '+' : '';
                return `**${placement} ${escapeMarkdown(player.username)}**: ${userMatch.eloAfter} → ${userMatch.eloBefore} (${sign}${userMatch.eloBefore - userMatch.eloAfter})`;
            }).join('\n');


            // Cleanup
            await sequelize.models.UserMatch.destroy({
                where: { matchId: lastMatch.id },
                transaction: t
            });

            await lastMatch.destroy({ transaction: t });
            await t.commit();


            const embed = new EmbedBuilder()
                .setColor('#47a166')
                .setTitle(`Match Undone: ${matchType}`)
                .addFields({ name: 'Reverted Player Ratings', value: message })

            return interaction.editReply({ embeds: [embed] });

        } catch (error) {
            await t.rollback();
            console.error('Error undoing match:', error);
            const errorEmbed = buildErrorEmbed('Error', 'There was an error while trying to undo the last match.');
            return interaction.editReply({ embeds: [errorEmbed] });
        }
	},
};