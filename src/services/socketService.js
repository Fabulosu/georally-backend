const { generateGame, checkNeighbour, isCoastCountry, canTravelByLand } = require('./gameService');
const { v4: uuidv4 } = require('uuid');

const socketHandler = (io) => {
    let games = {};
    let waitingQueue = [];

    let connectedPlayers = 0;

    io.on('connection', (socket) => {
        const userId = uuidv4();
        socket.userId = userId;
        socket.inGame = false;

        socket.on('joinQueue', (data) => {
            if (waitingQueue.includes(socket)) return;

            const isInGame = Object.values(games).some(game => game.players.includes(socket));
            if (isInGame) return;

            console.log(`Player joined queue: ${socket.id}`);

            connectedPlayers++;
            io.emit('updateClientCount', connectedPlayers);

            socket.difficulty = data.difficulty;
            waitingQueue.push(socket);

            const sameDifficultyPlayers = waitingQueue.filter(player => player.difficulty === data.difficulty);

            if (sameDifficultyPlayers.length >= 2) {
                const player1 = sameDifficultyPlayers.shift();
                const player2 = sameDifficultyPlayers.shift();

                waitingQueue = waitingQueue.filter(player => player !== player1 && player !== player2);

                const { gameId, startCountry, middleCountry, targetCountry } = generateGame();
                console.log(player1.id);
                console.log(player2.id);

                games[gameId] = { id: gameId, players: [player1, player2], state: 'playing', start: null, middle: null, target: null, difficulty: data.difficulty };

                const start = startCountry.name;
                const middle = middleCountry.name;
                const target = targetCountry.name;
                games[gameId].start = start;
                games[gameId].middle = middle;
                games[gameId].target = target;

                player1.join(gameId);
                player2.join(gameId);

                player1.emit('gameStart', {
                    gameId: gameId,
                    start: games[gameId].start,
                    middle: games[gameId].middle,
                    target: games[gameId].target,
                    difficulty: data.difficulty,
                    userId: player1.userId
                });

                player2.emit('gameStart', {
                    gameId: gameId,
                    start: games[gameId].start,
                    middle: games[gameId].middle,
                    target: games[gameId].target,
                    difficulty: data.difficulty,
                    userId: player2.userId
                });

                setTimeout(() => {
                    connectedPlayers -= 2;
                    io.emit('updateClientCount', connectedPlayers);
                }, 2000);

                console.log(`Game Room created: ${gameId} with players ${player1.userId} (${player1.id}), ${player2.userId} (${player2.id})`);
            }
        });

        socket.on('disconnect', () => {
            if (waitingQueue.includes(socket)) {
                waitingQueue.splice(waitingQueue.indexOf(socket), 1);
                console.log(`Player removed from queue: ${socket.id}`);
                connectedPlayers--;
                io.emit('updateClientCount', connectedPlayers);
            } else if (Object.values(games).some(game => game.players.includes(socket))) {
                const player = Object.values(games).find(game => game.players.includes(socket)).players.find(player => player === socket);

                if (player.inGame) {
                    const game = Object.values(games).find(game => game.players.includes(socket));
                    const opponentSocket = game.players.find(player => player !== socket);
                    game.players = game.players.filter(player => player !== socket);

                    if (game.state === 'ended') {
                        game.players.filter(player => player === socket);

                        if (game.players.length === 0) {
                            delete games[game.id];
                        }
                    } else {
                        if (opponentSocket) {
                            opponentSocket.emit('opponentLeft');
                            game.state = 'ended';
                        }
                        console.log(`Player left game: ${socket.userId} (${socket.id})`);
                    }
                }
            } else {
                console.log(`Player disconnected: ${socket.id}`);
                connectedPlayers--;
                io.emit('updateClientCount', connectedPlayers);
            }
        });

        socket.on('verifyGame', ({ gameId, start, middle, target, difficulty }) => {
            const game = games[gameId];
            if (!game) {
                socket.emit('gameVerified', { invalid: true, errorMessage: 'Game not found' });
            } else {
                const isVerified = game.start === start && game.middle === middle && game.target === target && game.difficulty === difficulty;

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

            console.log(`Player with id ${userId} (${socket.id}) joined the game with id: ${gameId}`);
        });

        socket.on('submit-neighbour', ({ gameId, country, neighbour, targetCountry }) => {
            const game = games[gameId];
            if (!game) return;

            if (isCoastCountry(country) && isCoastCountry(neighbour) && !canTravelByLand(country, targetCountry)) {
                socket.emit('correctAnswer', { country, neighbour, type: "overseas" });
            } else if (checkNeighbour(country, neighbour)) {
                socket.emit('correctAnswer', { country, neighbour, type: "ground" });
            } else {
                socket.emit('wrongAnswer', { country, neighbour });
            }
        });

        socket.on('gameOver', ({ gameId, userId, moves }) => {
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

            games[gameId].state = 'ended';
        });
    });
};

module.exports = socketHandler;