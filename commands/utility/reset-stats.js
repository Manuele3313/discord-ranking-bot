const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sequelize, Player, Match, UserMatch } = require('../../dbObjects.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('reset-stats')
        .setDescription('USE WITH CAUTION! Reset all player stats for the server and delete all match history.')
        // Only users with priviledge may run this command.
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers), 

	async execute(interaction) {
        await interaction.deferReply();
        const t = await sequelize.transaction();

        const buildErrorEmbed = (title, description) => new EmbedBuilder()
            .setColor('#ec4454')
            .setTitle(title)
            .setDescription(description);

        try {
            // Superficial query to get the matches. Might be used later
            // To display additional data.
            const serverMatches = await Match.findAll({
                where: { serverId: interaction.guildId },
                transaction: t
            });

            const statisticsToReset = {
                matchesPlayedTotal: 0,
                matchesWonTotal: 0,
                matchesPlayed2p: 0,
                matchesWon2p: 0,
                matchesPlayed3p: 0,
                matchesWon3p: 0,
                matchesPlayed4p: 0,
                matchesWon4p: 0,
                currentWinStreak: 0,
                maxWinStreak: 0,
                currentLossStreak: 0,
                maxLossStreak: 0,
                currentElo: 1500,
                bestElo: 1500,
                worstElo: 1500,
            };

            const [playersReset] = await Player.update(statisticsToReset, {
                where: { serverId: interaction.guildId },
                transaction: t
            });

            await UserMatch.destroy({
                where: { serverId: interaction.guildId },
                transaction: t
            });

            await Match.destroy({
                where: { serverId: interaction.guildId },
                transaction: t
            });

            await t.commit();

            const embed = new EmbedBuilder()
                .setColor('#47a166')
                .setTitle(`Statistics Reset`)
                .addFields(
                    { name: 'Matches Removed', value: `${serverMatches.length}`, inline: false },
                    { name: 'Players Reset', value: `${playersReset}`, inline: false }
                );

            return interaction.editReply({ embeds: [embed] });

        } catch (error) {
            if (!t.finished) {
                await t.rollback();
            }
            console.error('Error resetting stats:', error);
            const errorEmbed = buildErrorEmbed('Error', 'There was an error while trying to modify the database.');
            return interaction.editReply({ embeds: [errorEmbed] });
        }
	},
};