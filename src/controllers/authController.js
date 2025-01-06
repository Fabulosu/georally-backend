const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../configs');
const User = require('../models/user');

const register = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' });

    try {
        const userExists = await User.findOne({ username });
        if (userExists) return res.status(400).json({ message: 'User already exists.' });

        const newUser = new User({ username, password });
        await newUser.save();
        console.log(`User registered succesfully: ${username}`);
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ message: 'Error registering user.' });
    }
};

const login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        console.log(`User logged in: ${username}`);
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        console.error('Error logging in:', err);
        res.status(500).json({ message: 'Error logging in.' });
    }
};

module.exports = { register, login };