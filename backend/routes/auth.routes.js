const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken, requireAdmin } = require('../middlewares/auth');

router.post('/login', authController.login);
router.post('/register', verifyToken, requireAdmin, authController.register);
router.get('/me', verifyToken, authController.getMe);

module.exports = router;
