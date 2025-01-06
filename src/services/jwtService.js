const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../configs');

function generateToken(user) {
    return jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '1h' });
}

module.exports = { generateToken };