const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../configs');
const User = require('../models/user');

const register = async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: 'Username, email and password are required.' });

    try {
        const userExists = await User.findOne({ $or: [{ username }, { email }] });
        if (userExists) return res.status(400).json({ message: 'Username or email already exists.' });

        const newUser = new User({ username, email, password });
        await newUser.save();
        console.log(`User registered succesfully: ${username}`);
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ message: 'Error registering user.' });
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        console.log(`User logged in: ${email}`);
        // const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ user: { email: user.email, username: user.username } });
    } catch (err) {
        console.error('Error logging in:', err);
        res.status(500).json({ message: 'Error logging in.' });
    }
};

module.exports = { register, login };