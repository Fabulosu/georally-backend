const { generateCountries, isCoastCountry, canTravelByLand, checkNeighbour } = require("../../utils/functions");
const Game = require('../../models/game');
const User = require('../../models/user');
const { default: mongoose } = require('mongoose');

class Room {
    constructor(player1, player2, difficulty) {
        const { startCountry, middleCountry, targetCountry, bannedCountry } = generateCountries(difficulty);

        this.id = 'game-' + Math.random().toString(36).substring(2, 15);
        this.players = [player1, player2];
        this.state = 'created';
        this.start = startCountry.name;
        this.middle = middleCountry.name;
        this.target = targetCountry.name;
        this.banned = bannedCountry ? bannedCountry.name : null;
        this.difficulty = difficulty;

        global.gameManager.addGame(this);
    }

    getPlayer(userId) {
        return this.players.find(player => player.userId === userId) || null;
    }

    getOpponent(userId) {
        return this.players.find(player => player.userId !== userId) || null;
    }

    startGame() {
        this.players.forEach((player, index) => {
            player.joinGame(this.id);
            player.send('gameStart', {
                gameId: this.id,
                start: this.start,
                middle: this.middle,
                target: this.target,
                banned: this.banned,
                difficulty: this.difficulty,
                userId: player.userId,
                opponent: { username: this.players[1 - index].username }
            });
        });

        console.log(`Game Room created: ${this.id} with players ${this.players[0].userId}, ${this.players[1].userId}`);
    }

    verifyGame(data, socket) {
        const isVerified = this.start === data.start && this.middle === data.middle && this.target === data.target && this.banned === data.banned && this.difficulty === data.difficulty && this.state !== 'ended';
        if (isVerified) {
            const isPlayerInGame = this.players.some(player => player.userId === data.userId);
            const player = this.getPlayer(data.userId);
            socket.emit('gameVerified', { invalid: !isPlayerInGame, errorMessage: isPlayerInGame ? null : 'You are not part of this game', path: player.path, timeLeft: player.timeLeft });
        } else {
            socket.emit('gameVerified', { invalid: !isVerified, errorMessage: isVerified ? null : 'Invalid game data' });
        }
    }

    submitNeighbour(socket, country, neighbour, targetCountry) {
        if (isCoastCountry(country) && isCoastCountry(neighbour) && !canTravelByLand(country, targetCountry) && neighbour !== this.banned && country !== neighbour) {
            socket.emit('correctAnswer', { country, neighbour, type: "overseas" });
        } else if (checkNeighbour(country, neighbour) && neighbour !== this.banned) {
            socket.emit('correctAnswer', { country, neighbour, type: "ground" });
        } else {
            socket.emit('wrongAnswer', { country, neighbour });
        }
    }

    async endGame(winnerId, moves, reason) {
        const winner = this.players.find(player => player.userId === winnerId);
        const loser = this.players.find(player => player.userId !== winnerId);

        if (winner) winner.send('gameWon', { opponentMoves: moves });
        if (loser) loser.send('gameLost', { opponentMoves: moves });

        await this.saveGame({
            gameId: this.id,
            difficulty: this.difficulty,
            player1: this.players[0].userId,
            player2: this.players[1].userId,
            wonBy: winnerId
        });

        this.state = 'ended';
    }

    async saveGame(data) {
        const game = new Game(data);
        await game.save();

        let expToAdd = 0;

        switch (data.difficulty) {
            case "easy":
                expToAdd = 5;
                break;
            case "medium":
                expToAdd = 15;
                break;
            case "hard":
                expToAdd = 30;
                break;
            default:
                expToAdd = 0;
                break;
        }

        const winnerId = data.wonBy;
        const loserId = winnerId === data.player1 ? data.player2 : data.player1;

        const winner = mongoose.Types.ObjectId.isValid(winnerId) ? await User.findById(winnerId) : null;
        const loser = mongoose.Types.ObjectId.isValid(loserId) ? await User.findById(loserId) : null;

        if (winner) {
            await User.updateOne({ _id: winnerId }, { $inc: { experience: expToAdd } });
        }

        if (loser) {
            await User.updateOne({ _id: loserId }, { $inc: { experience: -expToAdd } });
        }

        console.log(`Game saved: ${game.gameId}`);
    }
}

module.exports = Room;