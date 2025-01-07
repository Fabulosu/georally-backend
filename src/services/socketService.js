const { generateGame, checkNeighbour, isCoastCountry } = require('./gameService');
const { v4: uuidv4 } = require('uuid');

const socketHandler = (io) => {
    let games = {};
    let waitingQueue = [];

    let connectedPlayers = 0;

    io.on('connection', (socket) => {
        console.log(`Player connected: ${socket.id}`);

        const userId = uuidv4();
        socket.userId = userId;
        socket.inGame = false;

        socket.on('joinQueue', () => {
            if (waitingQueue.includes(socket)) return;

            const isInGame = Object.values(games).some(game => game.players.includes(socket));
            if (isInGame) return;

            connectedPlayers++;
            io.emit('updateClientCount', connectedPlayers);

            waitingQueue.push(socket);

            if (waitingQueue.length >= 2) {
                const player1 = waitingQueue.shift();
                const player2 = waitingQueue.shift();

                const { gameId, startCountry, middleCountry, targetCountry } = generateGame();
                console.log(player1.id)
                console.log(player2.id)

                games[gameId] = { players: [player1, player2], state: 'playing', start: null, middle: null, target: null };

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
                    userId: player1.userId
                });

                player2.emit('gameStart', {
                    gameId: gameId,
                    start: games[gameId].start,
                    middle: games[gameId].middle,
                    target: games[gameId].target,
                    userId: player2.userId
                });

                setTimeout(() => {
                    connectedPlayers -= 2;
                    io.emit('updateClientCount', connectedPlayers);
                }, 1000);

                console.log(`Game Room created: ${gameId} with players ${player1.userId}, ${player2.userId}`);
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

                if (player.initiated) {
                    const game = Object.values(games).find(game => game.players.includes(socket));
                    const opponentSocket = game.players.find(player => player !== socket);
                    game.players = game.players.filter(player => player !== socket);

                    if (opponentSocket) {
                        opponentSocket.emit('opponentLeft');
                    }
                    delete games[game];
                    console.log(`Player left game: ${socket.id}`)
                }
            } else {
                connectedPlayers--;
                io.emit('updateClientCount', connectedPlayers);
            }
        });

        socket.on('verifyGame', ({ gameId, start, middle, target }) => {
            const game = games[gameId];
            if (!game) {
                socket.emit('gameVerified', { invalid: true, errorMessage: 'Game not found' });
            } else {
                const isVerified = game.start === start && game.middle === middle && game.target === target;
                socket.emit('gameVerified', { invalid: !isVerified, errorMessage: isVerified ? null : 'Invalid game data' });
            }
        });

        socket.on('rejoinGame', ({ gameId, userId }) => {
            const game = games[gameId];
            if (!game) return;

            socket.userId = userId;
            game.players = game.players.map(player => player.userId === userId ? socket : player);
            socket.inGame = true;
        });

        socket.on('submit-neighbour', ({ gameId, country, neighbour }) => {
            const game = games[gameId];
            if (!game) return;

            if (isCoastCountry(country) && isCoastCountry(neighbour)) {
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

            const opponentSocket = game.players.find(player => player.userId !== userId);
            if (opponentSocket) {
                opponentSocket.emit('opponentWon', { opponentMoves: moves });
            }

            delete games[gameId];
        });
    });
};

module.exports = socketHandler;