const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const deliveriesController = require('../controllers/deliveries.controller');

router.get('/my-route', verifyToken, deliveriesController.getMyRoute);
router.post('/attempt/:notification_id', verifyToken, deliveriesController.recordAttempt);

module.exports = router;
