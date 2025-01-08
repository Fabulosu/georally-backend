require('dotenv').config();

module.exports = {
    JWT_SECRET: process.env.JWT_SECRET,
    PORT: process.env.PORT || 3000,
    DEVMODE: process.env.DEVMODE
};