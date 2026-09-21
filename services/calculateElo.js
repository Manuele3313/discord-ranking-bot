function calculateElo(players) {
    /* 
    Implementation based on: https://github.com/FigBug/Multiplayer-ELO/blob/master/javascript/elo.js

    This function takes an array of "player" JSON objects with their Elo and their placement,
    and returns it with the updated rating.
    */

    const n = players.length;
    const kFactor = Math.round(32 / (n - 1));

    for (let i = 0; i < n; i++){
        const curPlace = players[i].place;
        const curELO = players[i].eloPre;

         for (let j = 0; j < n; j++) {
                if (i !== j) {
                    const oppPlace = players[j].place;
                    let oppELO = players[j].eloPre;
                    let s;
                    
                    if (curPlace < oppPlace) {
                        s = 1;
                    }
                    else if (curPlace === oppPlace) {
                        s = 0.5;
                    }
                    else {
                        s = 0;
                    }
                    
                    const ea = 1 / (1 + Math.pow(10, (oppELO - curELO) / 400));
                    players[i].eloChange += Math.round(kFactor * (s - ea));
                }
            }

            players[i].eloPost = players[i].eloPre + players[i].eloChange;
    }

    return players
}

module.exports = { calculateElo };