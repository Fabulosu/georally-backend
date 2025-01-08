const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./src/configs/database');

const authRoutes = require('./src/routes/authRoutes');

const { PORT, DEVMODE } = require('./src/configs');
const socketHandler = require('./src/services/socketService');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: DEVMODE ? '*' : 'https://georally.vercel.app',
        methods: ['GET', 'POST'],
    },
});

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);

connectDB().then(() => {
    if (DEVMODE) {
        server.listen(PORT, '192.168.0.107', () => {
            const os = require('os');
            const networkInterfaces = os.networkInterfaces();

            const localIP = Object.values(networkInterfaces)
                .flat()
                .find(
                    (iface) =>
                        iface.family === 'IPv4' &&
                        !iface.internal &&
                        iface.address.startsWith('192.168.')
                )?.address || 'localhost';

            console.log(`Server is running on:
            - Local: http://localhost:${PORT}
            - Network: http://${localIP}:${PORT}`);
        });
    } else {
        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    }

});

socketHandler(io);