const express = require('express');
const router = express.Router();
const { getAllUsers, createUser, deleteUser, updateUser } = require('../controllers/users.controller');
const { verifyToken, requireAdmin } = require('../middlewares/auth');

router.get('/', verifyToken, requireAdmin, getAllUsers);
router.post('/', verifyToken, requireAdmin, createUser);
router.put('/:id', verifyToken, requireAdmin, updateUser);
router.delete('/:id', verifyToken, requireAdmin, deleteUser);

module.exports = router;
