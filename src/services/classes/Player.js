const { v4: uuidv4 } = require('uuid');

class Player {
    constructor(socket, userId, username, difficulty) {
        this.socket = socket;
        this.userId = userId || uuidv4();
        this.username = username || `Guest${this.userId.slice(0, 4)}`;
        this.gameId = null;
        this.inGame = false;
        this.difficulty = difficulty;
        this.path = {};
        this.timeLeft = 0;

        global.gameManager.addPlayer(this);
    }

    send(event, data) {
        this.socket.emit(event, data);
    }

    updateSocket(socket) {
        this.socket = socket;
    }

    joinGame(gameId) {
        this.gameId = gameId;
        this.socket.join(gameId);
    }
}

module.exports = Player;