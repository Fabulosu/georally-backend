const { generateGame, checkNeighbour, isCoastCountry, canTravelByLand, saveGame } = require('./gameService');
const { v4: uuidv4 } = require('uuid');

global.activePlayers = 0;

const socketHandler = (io) => {
    let games = {};
    let waitingQueue = [];
    let reconnectTimers = {};

    io.on('connection', (socket) => {
        activePlayers++;
        socket.on('joinQueue', (data) => {
            if (waitingQueue.includes(socket)) return;

            const isInGame = Object.values(games).some(game => game.players.includes(socket));
            if (isInGame) return;
            let userId = null;
            let userName = null;

            if (data.userId) {
                userId = data.userId;
                userName = data.userName;
            } else {
                userId = uuidv4();
                userName = `Guest${userId.slice(0, 4)}`;
            }

            socket.userId = userId;
            socket.userName = userName;
            socket.inGame = false;

            socket.emit('joinedQueue', { userId });

            console.log(`Player joined queue: ${socket.userId} (${socket.id})`);

            socket.difficulty = data.difficulty;
            waitingQueue.push(socket);

            io.emit('updateClientCount', waitingQueue.length);

            const sameDifficultyPlayers = waitingQueue.filter(player => player.difficulty === data.difficulty);

            if (sameDifficultyPlayers.length >= 2) {
                const player1 = sameDifficultyPlayers.shift();
                const player2 = sameDifficultyPlayers.shift();

                waitingQueue = waitingQueue.filter(player => player !== player1 && player !== player2);
                io.emit('updateClientCount', waitingQueue.length);

                const { gameId, startCountry, middleCountry, targetCountry, bannedCountry } = generateGame(data.difficulty);

                games[gameId] = { id: gameId, players: [player1, player2], state: 'created', start: null, middle: null, target: null, banned: null, difficulty: data.difficulty };

                const start = startCountry.name;
                const middle = middleCountry.name;
                const target = targetCountry.name;
                const banned = bannedCountry ? bannedCountry.name : null;
                games[gameId].start = start;
                games[gameId].middle = middle;
                games[gameId].target = target;
                games[gameId].banned = banned;

                player1.join(gameId);
                player2.join(gameId);

                player1.emit('gameStart', {
                    gameId: gameId,
                    start: games[gameId].start,
                    middle: games[gameId].middle,
                    target: games[gameId].target,
                    banned: games[gameId].banned || null,
                    difficulty: data.difficulty,
                    userId: player1.userId,
                    opponent: { userName: player2.userName }
                });

                player2.emit('gameStart', {
                    gameId: gameId,
                    start: games[gameId].start,
                    middle: games[gameId].middle,
                    target: games[gameId].target,
                    banned: games[gameId].banned,
                    difficulty: data.difficulty,
                    userId: player2.userId,
                    opponent: { userName: player1.userName }
                });

                console.log(`Game Room created: ${gameId} with players ${player1.userId} (${player1.id}), ${player2.userId} (${player2.id})`);
            }
        });

        socket.on('disconnect', () => {
            activePlayers--;
            if (waitingQueue.includes(socket)) {
                waitingQueue.splice(waitingQueue.indexOf(socket), 1);
                console.log(`Player removed from queue: ${socket.id}`);
                io.emit('updateClientCount', waitingQueue.length);
            } else if (Object.values(games).some(game => game.players.includes(socket))) {
                const player = Object.values(games).find(game => game.players.includes(socket)).players.find(player => player === socket);

                if (player.inGame) {
                    const game = Object.values(games).find(game => game.players.includes(socket));
                    const opponentSocket = game.players.find(player => player !== socket);

                    if (game.state === 'ended') {
                        game.players.filter(player => player === socket);

                        if (game.players.length === 0) {
                            delete games[game.id];
                            console.log(`The game ${game.id} has ended and both players have disconnected. The game is now deleted.`);
                        }
                    } else {
                        if (reconnectTimers[opponentSocket.userId]) {
                            console.log(`Both players left the game ${game.id}. The game is now deleted.`);
                            delete games[game.id];
                        } else {
                            reconnectTimers[socket.userId] = setTimeout(() => {
                                if (opponentSocket) {
                                    opponentSocket.emit('opponentLeft');
                                    game.state = 'ended';
                                }
                                console.log(`Player left game: ${socket.userId} (${socket.id})`);
                            }, 30000);
                        }
                        console.log(`Player ${socket.userId} (${socket.id}) disconnected from game ${game.id}`);
                        opponentSocket.emit('opponentDisconnect');
                    }
                }
            } else {
                console.log(`Player disconnected: ${socket.id}`);
                io.emit('updateClientCount', waitingQueue.length);
            }
        });

        socket.on('verifyGame', ({ gameId, start, middle, target, banned, difficulty }) => {
            const game = games[gameId];
            if (!game) {
                socket.emit('gameVerified', { invalid: true, errorMessage: 'Game not found' });
            } else {
                const isVerified = game.start === start && game.middle === middle && game.target === target && game.banned === banned && game.difficulty === difficulty && game.state !== 'ended';

                if (isVerified) {
                    setTimeout(() => {
                        const gamePlayers = game.players.map(player => player.userId);
                        if (socket.userId !== gamePlayers[0] && socket.userId !== gamePlayers[1]) {
                            socket.emit('gameVerified', { invalid: true, errorMessage: 'You are not part of this game' });
                        } else {
                            socket.emit('gameVerified', { invalid: false, errorMessage: null });
                        }
                    }, 2000);
                } else {
                    console.log(game, { gameId, start, middle, target, banned, difficulty })
                    socket.emit('gameVerified', { invalid: !isVerified, errorMessage: isVerified ? null : 'Invalid game data' });
                }
            }
        });

        socket.on('rejoinGame', ({ gameId, userId }) => {
            const game = games[gameId];
            if (!game) return;

            socket.userId = userId;
            game.players = game.players.map(player => player.userId === userId ? socket : player);
            socket.inGame = true;

            const opponentSocket = game.players.find(player => player.userId !== userId);

            const bothPlayersInGame = game.players.every(player => player.inGame);
            if (bothPlayersInGame && !reconnectTimers[userId]) {
                socket.emit('opponentConnected');
                opponentSocket.emit('opponentConnected');

                setTimeout(() => {
                    game.state = 'playing';
                    socket.emit('gameStarted');
                    opponentSocket.emit('gameStarted');
                }, 4000);
            }

            if (reconnectTimers[userId]) {
                clearTimeout(reconnectTimers[userId]);
                delete reconnectTimers[userId];

                socket.emit('opponentConnected');
                socket.emit('gameStarted');
                opponentSocket.emit('gameStarted');

                if (opponentSocket) {
                    opponentSocket.emit('opponentReconnect');
                }

                console.log(`Player with id ${userId} (${socket.id}) rejoined the game with id: ${gameId}`);
            }

            console.log(`Player with id ${userId} (${socket.id}) joined the game with id: ${gameId}`);
        });

        socket.on('submit-neighbour', ({ gameId, country, neighbour, targetCountry }) => {
            const game = games[gameId];
            if (!game) return;

            if (isCoastCountry(country) && isCoastCountry(neighbour) && !canTravelByLand(country, targetCountry) && neighbour !== game.banned) {
                socket.emit('correctAnswer', { country, neighbour, type: "overseas" });
            } else if (checkNeighbour(country, neighbour) && neighbour !== game.banned) {
                socket.emit('correctAnswer', { country, neighbour, type: "ground" });
            } else {
                socket.emit('wrongAnswer', { country, neighbour });
            }
        });

        socket.on('gameOver', async ({ gameId, userId, moves }) => {
            const game = games[gameId];
            if (!game) return;

            const playerSocket = game.players.find(player => player.userId === userId);
            if (playerSocket) {
                playerSocket.emit('gameWon', { opponentMoves: moves });
            }

            const opponentSocket = game.players.find(player => player.userId !== userId);
            if (opponentSocket) {
                opponentSocket.emit('opponentWon', { opponentMoves: moves });
            }

            await saveGame({ gameId, difficulty: game.difficulty, player1: playerSocket.userId, player2: opponentSocket.userId, wonBy: playerSocket.userId });

            games[gameId].state = 'ended';
        });
    });
};

module.exports = socketHandler;