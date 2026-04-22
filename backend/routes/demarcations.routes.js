const express = require('express');
const router = express.Router();
const demarcationsController = require('../controllers/demarcations.controller');
const { verifyToken, requireAdmin } = require('../middlewares/auth');

router.get('/', verifyToken, requireAdmin, demarcationsController.getAllAssignments);
router.post('/', verifyToken, requireAdmin, demarcationsController.assignStreetToUser);
router.delete('/:id', verifyToken, requireAdmin, demarcationsController.removeAssignment);
router.get('/user/:userId', verifyToken, demarcationsController.getUserStreets);

module.exports = router;
