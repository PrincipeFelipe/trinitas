const express = require('express');
const router = express.Router();
const { getAllUsers, createUser, deleteUser, updateUser } = require('../controllers/users.controller');
const { verifyToken, requirePermission } = require('../middlewares/auth');

router.get('/', verifyToken, requirePermission(['users', 'notifications', 'demarcations']), getAllUsers);
router.post('/', verifyToken, requirePermission('users'), createUser);
router.put('/:id', verifyToken, requirePermission('users'), updateUser);
router.delete('/:id', verifyToken, requirePermission('users'), deleteUser);

module.exports = router;
