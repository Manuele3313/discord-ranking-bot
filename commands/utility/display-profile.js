const { SlashCommandBuilder, EmbedBuilder, escapeMarkdown, AttachmentBuilder } = require('discord.js');
const { Player, Match } = require('../../dbObjects.js');
const { Op } = require('sequelize');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('display-profile')
        .setDescription('Display the stats of a player.')
        .addUserOption(option => option.setName('user').setDescription('Player to display').setRequired(true)),

	async execute(interaction) {

        // Defer the reply 
        await interaction.deferReply();

        try {

            const user = interaction.options.getUser('user')
            const player = await Player.findOne({ where: { discordId: user.id, serverId: interaction.guildId } });

            if (!player) {
                return interaction.editReply("This user has never played any games!");
            }

            // This could probably be optimized
            
            // Get the ranking of the player based on total winrate
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
            
            const leaderboardRanking = allPlayers.findIndex(u => u.discordId === user.id) + 1;          
            
            // Add Emoji if the player is in the top 3
            let leaderboardRankingDisplayed = ""
            let embedColor = "#5965ee"

            switch(leaderboardRanking){
                case 1:
                    leaderboardRankingDisplayed = "👑";
                    embedColor = "#ffcb51";
                    break
                case 2:
                    leaderboardRankingDisplayed = "🥈";
                    embedColor = "#cbd5dc";
                    break
                case 3:
                    leaderboardRankingDisplayed = "🥉";
                    embedColor = "#fe8b42";
                    break
                // If unranked the index is (-1 + 1) = 0
                case 0:
                    leaderboardRankingDisplayed = "";
                    embedColor = "#949494";
                    break
                default:
                    leaderboardRankingDisplayed = `${leaderboardRanking}th`;
            }

            const matches = await player.getMatches({
                order: [['date', 'DESC']],
                limit: 4,
                through: {
                    attributes: ['placement']
                }
            });

            let recentMatchesText = '';
            if (matches && matches.length > 0) {
                matches.forEach((match) => {
                    let result = '';
                    switch (match.UserMatch.placement) {
                        case 1:
                            result = '🥇 **Won**';
                            break;
                        case 2:
                            result = '🥈 **Lost**';
                            break;
                        case 3:
                            result = '🥉 **Lost**';
                            break;
                        default:
                            result = '❌ **Lost**';
                    }

                    // Removed displayed opponents in favor of a more simple display.
                    // const opponents = match.Players.filter(p => p.discordId !== player.discordId).map(p => `${escapeMarkdown(p.username)}`);
                    // const opponentsText = opponents.length > 0 ? `vs ${opponents.join(', ')}` : 'vs Unknown';

                    // Format date using Discord relative timestamp
				    const dateString = `<t:${Math.floor(match.date.getTime() / 1000)}:R>`; 
                    recentMatchesText += `${result} ${dateString}\n`;
                });
            } else {
                recentMatchesText = 'No recent matches.';
            }

            // Get data for the chart
            const allMatches = await player.getMatches({
                order: [['date', 'ASC']],
                through: {
                    attributes: ['eloAfter']
                }
            });

            let xLabels = ["Start"];
            // The Starting Elo is always the same
            let yData = [1500];
            for (let i = 0; i < allMatches.length; i++) {
                const match = allMatches[i];
                yData.push(match.UserMatch.eloAfter)
                xLabels.push(String(i + 1))
            }

            // Chart with quickchart.io
            const chart = {
                "type": "line",
                "data": {
                    "labels": xLabels,
                    "datasets": [
                    {
                        "data": yData,
                        "fill": false,
                        "borderColor": "rgb(194, 182, 120)",
                        "backgroundColor": "rgba(0, 0, 0, 0)",
                        "pointRadius": 3,
                        "tension": 0.3
                    }
                    ]
                },
                "options": {
                    "plugins": {
                    "title": {
                        "display": true,
                        "text": "Simple Line Graph",
                        "font": { "size": 18 }
                    },
                    },
                    "legend": {
                    "display": false,
                    },
                    "scales":{
                    "xAxes":[
                        {
                        "scaleLabel":{"display":false,"labelString":"Match+Progression","fontColor":"white"},
                        "gridLines":{"color":"rgba(255,255,255,0.1)"},
                        "ticks":{"fontColor":"rgba(255,255,255,0.7)"}
                        }],
                    "yAxes":[
                        { 
                        "scaleLabel":{"display":true,"labelString":"Elo Rating","fontColor":"white"},    
                        "ticks":{"suggestedMin":(Math.round(player.worstElo / 50) * 50),"suggestedMax":(Math.round(player.worstElo / 50) * 50),"fontColor":"rgba(255,255,255,0.7)","stepSize":25},
                        "gridLines":{"color":"rgba(255,255,255,0.1)"}
                        }
                        ]
                    },
                },
                    "responsive": true,
                    "maintainAspectRatio": false
            }

            const chartResponse = await fetch('https://quickchart.io/chart', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chart,
                    width: 800,
                    height: 400,
                    backgroundColor: 'transparent'
                })
            });

            if (!chartResponse.ok) {
                throw new Error(`QuickChart request failed: ${chartResponse.status} ${chartResponse.statusText}`);
            }

            const chartBuffer = Buffer.from(await chartResponse.arrayBuffer());
            const chartAttachment = new AttachmentBuilder(chartBuffer, { name: 'elo-chart.png' });

            const playerEmbed = new EmbedBuilder()
                .setTitle(`${leaderboardRankingDisplayed} ${escapeMarkdown(player.username)}`)
                .setColor(embedColor)
                .setThumbnail(`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}`)
                .setDescription(`${player.bio}`)    
                .addFields(
                { name: 'Current Elo', value: `**${player.currentElo}**`, inline: true },
                { name: 'Games Played', value: `${player.matchesPlayedTotal}`, inline: true },
                { name: 'Max/Min Elo', value: `Peak: ${player.bestElo}\nLowest: ${player.worstElo}`, inline: true },
	            )    
                .addFields(
                { name: 'Win Rate', value: `**Total**: ${player.getWinRate()}%\n **2 Players**: ${player.getWinRate('2p')}%\n **3 Players**: ${player.getWinRate('3p')}%\n **4 Players**: ${player.getWinRate('4p')}%`, inline: true },
                // Blank field for spacing
                // { name: '\u200b', value: '\u200b', inline: true },
                { name: 'Recent Matches', value: recentMatchesText, inline: true },

	            )   
                .addFields(
                { name: 'Win Streak', value: `🔥 Current: ${player.currentWinStreak}\n🏆 Best: ${player.maxWinStreak}\n`, inline: false},
                { name: 'Loss Streak', value: `❄️ Current: ${player.currentLossStreak}\n🧊 Worst: ${player.maxLossStreak}\n`, inline: true},
	            )
                .setImage('attachment://elo-chart.png');

            if(leaderboardRanking === 0){
                playerEmbed.setFooter({text: `You are \`unranked\`.\n Play ${10 - player.matchesPlayedTotal} more matches to appear in the leaderboard.`})
            }

            await interaction.editReply({ embeds: [playerEmbed], files: [chartAttachment] });
        } catch (error) {
            console.error('Error fetching player data:', error);
            await interaction.editReply('There was an error while executing this command.');
        }
	},
};