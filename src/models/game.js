const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    gameId: {type: String, required: true, unique: true},
    player1: {type: String, ref: "User", required: true},
    player2: {type: String, ref: "User", required: true},
    wonBy: {type: String, ref: "User", required: true},
    date: {type: Date, default: Date.now}
});

const Game = mongoose.model("Game", gameSchema);

module.exports = Game;