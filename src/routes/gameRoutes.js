const express = require('express');
const { fetchLeaderboard, fetchStats } = require('../controllers/gameController');

const router = express.Router();

router.get('/leaderboard', fetchLeaderboard);
router.get('/stats', fetchStats);

module.exports = router;