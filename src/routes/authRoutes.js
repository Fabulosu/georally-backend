const express = require('express');
const { register, login, refreshToken } = require('../controllers/authController');
const authenticateToken = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.get('/profile', authenticateToken, (req, res) => {
    res.json({ message: `Hello, ${req.user.username}` });
});

module.exports = router;