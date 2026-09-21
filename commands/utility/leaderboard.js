const { SlashCommandBuilder, EmbedBuilder, escapeMarkdown } = require('discord.js');
const { Player, Match } = require('../../dbObjects.js');
const { Op } = require('sequelize');


module.exports = {
	data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Display the 20 best players'),

	async execute(interaction) {

        // Defer the reply 
        await interaction.deferReply();

        try {

            // Fetch all players
            const allPlayers = await Player.findAll({
                where:{
                    matchesPlayedTotal: { [Op.gte]: 10 },
                    serverId: interaction.guildId
                }
            });
                
            allPlayers.sort((a, b) => {
                            const eloA = a.currentElo;
                            const eloB = b.currentElo;
                            if (eloA === eloB) {
                                return b[`matchesPlayedTotal`] - a[`matchesPlayedTotal`];
                            }
                            return eloB - eloA;
            });

            const topPlayers = allPlayers.slice(0, 20);

            if (topPlayers.length === 0) {
                return interaction.editReply('The leaderboard is currently empty. Go play some matches!');
            }

            const title = `🏆 Leaderboard`

            const leaderboardEmbed = new EmbedBuilder()
                .setTitle(title)
                .setColor('#ffeb0c')
                .setFooter({ text: 'Brought to you by John Arcana' })

            // Format the player data into a readable list
            let leaderboardText = '';
            for (let i = 0; i < topPlayers.length; i++) {
                const player = topPlayers[i];
                if(i === 0){
                    leaderboardText += `👑  **${escapeMarkdown(player.username)}**: ${player.currentElo} Elo\n`;
                } else if(i === 1){
                    leaderboardText += `🥈  **${escapeMarkdown(player.username)}**: ${player.currentElo} Elo\n`;
                } else if(i === 2){
                    leaderboardText += `🥉  **${escapeMarkdown(player.username)}**: ${player.currentElo} Elo\n`;
                } else {
                    leaderboardText += `**${i + 1}th**  **${escapeMarkdown(player.username)}**: ${player.currentElo} Elo\n`;
                }
            }

            leaderboardEmbed.setDescription(leaderboardText);

            await interaction.editReply({ embeds: [leaderboardEmbed] });

        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            await interaction.editReply('There was an error trying to fetch the leaderboard data from the database.');
        }
	},
};