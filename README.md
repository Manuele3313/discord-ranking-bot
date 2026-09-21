# Discord Ranking Bot

> A Discord slash-command bot for tracking multiplayer match results, Elo ratings,
> player profiles, streaks, and match history.

The bot is designed for games with **two to four players** and exactly one first-place
winner per match. Each Discord server has its own isolated player profiles, ratings,
statistics, and match history.

## Highlights

- Slash-command-first Discord UX powered by [discord.js](https://discord.js.org/).
- Multiplayer Elo calculations for 2-player, 3-player, and 4-player matches.
- Per-server isolation: activity in one server never affects another server.
- Player profiles with custom display names and biographies.
- Current, peak, and lowest Elo ratings.
- Total and per-format match statistics.
- Current and maximum win/loss streaks.
- Paginated complete match history.
- Filtered match history for one or more selected players.
- Elo progression chart in each player profile, generated through
  [QuickChart](https://quickchart.io/).
- Transactional match recording, undo, and server reset operations.
- SQLite storage with Sequelize models and no external database server required.

## Commands

All commands are slash commands and are deployed globally by the default deployment
script. Discord may take a while to make globally deployed command changes visible.

### `/record-match`

Records a match and updates player ratings and statistics.

The command creates a new profile automatically when a participant plays for the
first time. New players start at **1500 Elo**.

### `/record-match-undo`

Undoes the most recently recorded match in the current server.

Use this immediately when a match was entered incorrectly. It always targets the
latest match for the current server.

### `/display-profile`

Displays a player's profile and statistics.


Players need at least ten matches to appear in the leaderboard. A profile can still
be viewed before that threshold and is marked as unranked.

The chart is requested from QuickChart at command time, so the bot needs outbound
HTTPS access to `quickchart.io`.

### `/leaderboard`

Displays the top 20 ranked players in the current server, ordered by Elo, descending.

Only players with at least **10 total matches** qualify. Players are ordered by:

### `/match-history`

Displays every recorded match in the current server, newest first.

History is shown five matches per page with interactive **First**, **Previous**,
**Next**, and **Last** buttons.

The pagination state is held in memory by the running bot process. If the bot
restarts, an old history message's buttons expire and the command must be run again.

### `/player-match-history`

Displays recent matches involving one or more selected players.

The command finds matches containing all selected players, and then displays their results.

### `/setusername`

Sets the invoking user's displayed ranking name for the current server.

This only changes the name displayed by the bot. It does not change the user's Discord username.

### `/setbio`

Sets the invoking user's profile biography for the current server.

The biography appears in `/display-profile`. A profile is created automatically if necessary.

### `/reset-stats`

Resets every statistic for every player in the current server and permanently
deletes that server's match history and match-player records.

There is no recovery for this command. Back up `database.sqlite` before using this command.

## Requirements

- Node.js **18.17 or newer** (Node.js 20 LTS or newer is recommended).
- npm.
- A Discord application and bot token.
- A Discord server where you can install applications.
- Outbound HTTPS access for Discord and QuickChart.

No hosted database is required. Sequelize creates and uses a local SQLite file.
This is not meant to be a production-grade application.

## Installation
Assuming you already have a Discord Bot configured in the [Discord developer portal](https://discord.com/developers/applications).

### 1. Clone the repository

```bash
git clone https://github.com/Kyro3313/discord-ranking-bot.git
cd discord-ranking-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create the configuration file

Create `config.json` in the project root:

```json
{
  "token": "YOUR_DISCORD_BOT_TOKEN",
  "clientId": "YOUR_APPLICATION_ID",
}
```

### 5. Initialize the database and deploy commands

```bash
npm run init
```

This runs the database sync and global slash-command deployment. The resulting
SQLite database is stored as `database.sqlite` in the project root.

### 6. Start the bot

```bash
npm start
```