module.exports = (sequelize, DataTypes) => {

  const Player = sequelize.define('Player', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    discordId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    serverId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false
    },
    bio: {
      type: DataTypes.TEXT,
      defaultValue: "Set a description with \`\\setbio\` !"
    },

    // Information regarding the matches and other game-related statistics

    matchesPlayedTotal: { type: DataTypes.INTEGER, defaultValue: 0 },
    matchesWonTotal: { type: DataTypes.INTEGER, defaultValue: 0 },
    
    matchesPlayed2p: { type: DataTypes.INTEGER, defaultValue: 0 },
    matchesWon2p: { type: DataTypes.INTEGER, defaultValue: 0 },

    matchesPlayed3p: { type: DataTypes.INTEGER, defaultValue: 0 },
    matchesWon3p: { type: DataTypes.INTEGER, defaultValue: 0 },

    matchesPlayed4p: { type: DataTypes.INTEGER, defaultValue: 0 },
    matchesWon4p: { type: DataTypes.INTEGER, defaultValue: 0 },

    currentWinStreak: { type: DataTypes.INTEGER, defaultValue: 0 },
    maxWinStreak: { type: DataTypes.INTEGER, defaultValue: 0 },
    
    currentLossStreak: { type: DataTypes.INTEGER, defaultValue: 0 },
    maxLossStreak: { type: DataTypes.INTEGER, defaultValue: 0 },

    currentElo: { type: DataTypes.INTEGER, defaultValue: 1500 },
    bestElo: { type: DataTypes.INTEGER, defaultValue: 1500 },
    worstElo: { type: DataTypes.INTEGER, defaultValue: 1500 },

  }, {
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['discordId', 'serverId']
      }
    ]
  });

  // Instance method to calculate win rate
  Player.prototype.getWinRate = function(matchType = 'Total') {
    const playedKey = `matchesPlayed${matchType}`;
    const wonKey = `matchesWon${matchType}`;

    const played = this.getDataValue(playedKey);
    const won = this.getDataValue(wonKey);

    if (played === 0) {
      return 0;
    }
    return Math.round((won / played) * 100);
  };
  return Player;
};