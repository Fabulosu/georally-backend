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

        const payload = {
            username: user.username,
            email: user.email,
            _id: user._id,
        }

        res.status(200).json({
            user: {
                _id: user._id,
                email: user.email,
                username: user.username
            },
            backendTokens: {
                accessToken: jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }),
                refreshToken: jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }),
                expiresIn: new Date().setTime(new Date().getTime() + 3600 * 1000),
            },
        });
    } catch (err) {
        console.error('Error logging in:', err);
        res.status(500).json({ message: 'Error logging in.' });
    }
};

const refreshToken = async (req, res) => {
    const payload = req.user;

    res.status(200).json({
        backendTokens: {
            accessToken: jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }),
            refreshToken: jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
        },
    });
}

module.exports = { register, login, refreshToken };