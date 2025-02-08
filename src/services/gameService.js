const countries = require('../utils/countries.json');
const { coastCountries } = require('../utils/coastCountries.json');
const Game = require('../models/game');
const User = require('../models/user');
const { default: mongoose } = require('mongoose');

function generateGame(difficulty) {
    const gameId = 'game-' + Math.random().toString(36).substring(2, 15);
    let startCountry, middleCountry, targetCountry, bannedCountry;

    do {
        startCountry = countries[Math.floor(Math.random() * countries.length)];
        middleCountry = countries[Math.floor(Math.random() * countries.length)];
        targetCountry = countries[Math.floor(Math.random() * countries.length)];
        bannedCountry = countries[Math.floor(Math.random() * countries.length)];
    } while (startCountry === middleCountry || middleCountry === targetCountry || startCountry === targetCountry || bannedCountry === targetCountry || bannedCountry === startCountry || bannedCountry === middleCountry);

    if (difficulty === "hard" && Math.random() * 100 < 25) {
        return { gameId, startCountry, middleCountry, targetCountry, bannedCountry };
    } else {
        return { gameId, startCountry, middleCountry, targetCountry, bannedCountry: null };
    }
}

function isCoastCountry(country) {
    return coastCountries.includes(country);
}

function checkNeighbour(country, neighbour) {
    const countryObj = countries.find(c => c.name === country);
    if (countryObj && countryObj.neighbours.includes(neighbour)) {
        return true;
    } else {
        return false;
    }
}

function canTravelByLand(startCountry, targetCountry) {
    const visited = new Set();
    const stack = [[startCountry, [startCountry]]];

    while (stack.length > 0) {
        const [currentCountry, path] = stack.pop();
        if (currentCountry === targetCountry) {
            console.log(path)
            return true;
        }
        if (!visited.has(currentCountry)) {
            visited.add(currentCountry);
            const countryObj = countries.find(c => c.name === currentCountry);
            if (countryObj) {
                for (const neighbour of countryObj.neighbours) {
                    if (!visited.has(neighbour)) {
                        stack.push([neighbour, path.concat(neighbour)]);
                    }
                }
            }
        }
    }
    return false;
}

async function saveGame(data) {
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

module.exports = { generateGame, isCoastCountry, checkNeighbour, canTravelByLand, saveGame }