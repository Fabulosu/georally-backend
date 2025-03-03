class GameManager {
    constructor() {
        this.players = {};
        this.games = {};
    };

    addPlayer(player) {
        this.players[player.userId] = player;
    };

    addGame(game) {
        this.games[game.id] = game;
    }

    getPlayer(socket) {
        const playerId = Object.keys(this.players).find(userId => this.players[userId].socket === socket);
        return this.players[playerId];
    }

    getGame(gameId) {
        return this.games[gameId];
    }

    deletePlayer(socket) {
        const playerId = Object.keys(this.players).find(userId => this.players[userId].socket === socket);
        if (playerId) {
            delete this.players[playerId];
        }
    }

    deleteGame(gameId) {
        delete this.games[gameId];
    }
}

module.exports = GameManager;