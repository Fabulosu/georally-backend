const Game = require('../models/game');
const User = require('../models/user');

const fetchLeaderboard = async (req, res) => {
    try {
        const games = await Game.find();
        const leaderboard = {};

        games.forEach(game => {
            if (game.wonBy) {
                if (!leaderboard[game.wonBy]) {
                    leaderboard[game.wonBy] = { wins: 0, totalGames: 0 };
                }
                leaderboard[game.wonBy].wins++;
            }
            if (game.player1) {
                if (!leaderboard[game.player1]) {
                    leaderboard[game.player1] = { wins: 0, totalGames: 0 };
                }
                leaderboard[game.player1].totalGames++;
            }
            if (game.player2) {
                if (!leaderboard[game.player2]) {
                    leaderboard[game.player2] = { wins: 0, totalGames: 0 };
                }
                leaderboard[game.player2].totalGames++;
            }
        });

        const sortedLeaderboard = Object.entries(leaderboard)
            .sort((a, b) => b[1].wins - a[1].wins)
            .slice(0, 10);
        const validObjectId = id => /^[0-9a-fA-F]{24}$/.test(id);
        const filteredLeaderboard = sortedLeaderboard.filter(entry => validObjectId(entry[0]));
        const leaderboardWithUsernames = await Promise.all(filteredLeaderboard.map(async entry => {
            const user = await User.findById(entry[0]);
            const winRate = (entry[1].wins / entry[1].totalGames) * 100;
            return { 
                username: user.username, 
                totalGames: entry[1].totalGames, 
                wonGames: entry[1].wins, 
                winRate: winRate.toFixed(2) 
            };
        }));

        res.status(200).json(leaderboardWithUsernames);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching leaderboard', error });
    }
}

const fetchStats = async (req, res) => {
    try {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

        const totalPlayers = await User.countDocuments();
        const gamesToday = await Game.find({
            date: {
                $gte: today,
                $lt: tomorrow
            }
        });

        res.status(200).json({ totalPlayers: totalPlayers, gamesPlayedToday: gamesToday.length, activePlayers: global.connectedPlayers });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching statistics', error });
    }
}

module.exports = { fetchLeaderboard, fetchStats };