const GameManager = require('./classes/GameManager');
const Player = require('./classes/Player');
const Room = require('./classes/Room');

global.activePlayers = 0;
global.gameManager = new GameManager();

const socketHandler = (io) => {
    let waitingQueue = [];
    let reconnectTimers = {};

    io.on('connection', (socket) => {
        socket.on('joinQueue', (data) => {
            if (waitingQueue.some(player => player.socket === socket)) return;

            const player = new Player(socket, data.userId, data.userName, data.difficulty);

            socket.emit('joinedQueue', { userId: player.userId });
            console.log(`Player joined queue: ${player.userId} (${socket.id})`);

            waitingQueue.push(player);
            io.emit('updateClientCount', waitingQueue.length);

            const sameDifficultyPlayers = waitingQueue.filter(p => p.difficulty === data.difficulty);

            if (sameDifficultyPlayers.length >= 2) {
                const player1 = sameDifficultyPlayers.shift();
                const player2 = sameDifficultyPlayers.shift();

                waitingQueue = waitingQueue.filter(p => p !== player1 && p !== player2);
                io.emit('updateClientCount', waitingQueue.length);

                const game = new Room(player1, player2, data.difficulty);
                game.startGame();
            }
        });

        socket.on('verifyGame', ({ userId, gameId, start, middle, target, banned, difficulty }) => {
            const game = gameManager.getGame(gameId);
            if (game) {
                game.verifyGame({ userId, gameId, start, middle, target, banned, difficulty }, socket);
            } else {
                socket.emit('gameVerified', { invalid: true, errorMessage: 'Invalid game data' });
            }
        });

        socket.on('rejoinGame', ({ gameId, userId }) => {
            const game = gameManager.getGame(gameId);
            if (!game) return;

            const player = game.getPlayer(userId);
            player.updateSocket(socket);

            const opponent = game.getOpponent(userId);
            player.inGame = true;
            opponent.inGame = true;

            const bothPlayersInGame = player.inGame && opponent.inGame;

            if (bothPlayersInGame && !reconnectTimers[userId]) {
                player.send('opponentConnected');
                opponent.send('opponentConnected');

                setTimeout(() => {
                    game.state = 'playing';
                    player.send('gameStarted');
                    opponent.send('gameStarted');
                }, 4000);
            }

            if (reconnectTimers[userId]) {
                clearTimeout(reconnectTimers[userId]);
                delete reconnectTimers[userId];

                player.send('opponentConnected');
                player.send('gameStarted');
                opponent.send('gameStarted');

                if (opponent) {
                    opponent.send('opponentReconnect');
                }

                console.log(`Player with id ${userId} (${socket.id}) rejoined the game with id: ${gameId}`);
            }
        });

        socket.on('submit-neighbour', ({ gameId, country, neighbour, targetCountry }) => {
            const game = gameManager.getGame(gameId);
            if (!game) return;

            game.submitNeighbour(socket, country, neighbour, targetCountry);
        });

        socket.on('gameOver', ({ gameId, userId, moves, reason }) => {
            const game = gameManager.getGame(gameId);
            if (!game) return;

            game.endGame(userId, moves, reason);
        });

        socket.on('savePlayerData', (data) => {
            const player = gameManager.getPlayer(socket);
            if (!player) return;

            player.path = data.path;
            player.timeLeft = data.timeLeft;
        });

        socket.on('disconnect', () => {
            activePlayers--;
            const player = gameManager.getPlayer(socket);
            if (!player) return;
            if (waitingQueue.includes(player)) {
                waitingQueue.splice(waitingQueue.indexOf(player), 1);
                console.log(`Player removed from queue: ${player.userId} (${socket.id})`);
                gameManager.deletePlayer(socket);
                io.emit('updateClientCount', waitingQueue.length);
            } else if (player.gameId !== null) {
                if (player.inGame) {
                    const game = gameManager.getGame(player.gameId);
                    const opponent = game.getOpponent(player.userId);

                    if (game.state === 'ended') {
                        game.players.filter(player => player === player);

                        if (game.players.length === 0) {
                            gameManager.deleteGame(game.id);
                            console.log(`The game ${game.id} has ended and both players have disconnected. The game is now deleted.`);
                        }
                    } else {
                        if (reconnectTimers[opponent.userId]) {
                            console.log(`Both players left the game ${game.id}. The game is now deleted.`);
                            gameManager.deleteGame(game.id);
                        } else {
                            reconnectTimers[player.userId] = setTimeout(() => {
                                if (opponent) {
                                    opponent.send('opponentLeft');
                                    game.state = 'ended';
                                }
                                console.log(`Player left game: ${player.userId} (${socket.id})`);
                            }, 30000);
                        }
                        console.log(`Player ${player.userId} (${socket.id}) disconnected from game ${game.id}`);
                        opponent.send('opponentDisconnect');
                    }
                }
            } else {
                console.log(`Player disconnected: ${socket.id}`);
                io.emit('updateClientCount', waitingQueue.length);
            }
        });
    });
};

module.exports = socketHandler;