const express = require('express');
const router = express.Router();
const demarcationsController = require('../controllers/demarcations.controller');
const { verifyToken, requirePermission } = require('../middlewares/auth');

router.get('/', verifyToken, requirePermission('demarcations'), demarcationsController.getAllAssignments);
router.post('/', verifyToken, requirePermission('demarcations'), demarcationsController.assignStreetToUser);
router.delete('/:id', verifyToken, requirePermission('demarcations'), demarcationsController.removeAssignment);
router.get('/user/:userId', verifyToken, demarcationsController.getUserStreets);

module.exports = router;
