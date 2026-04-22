const express = require('express');
const router = express.Router();
const streetsController = require('../controllers/streets.controller');
const { verifyToken, requireAdmin } = require('../middlewares/auth');

router.get('/', verifyToken, streetsController.getAllStreets);
router.get('/:id', verifyToken, streetsController.getStreetById);
router.post('/', verifyToken, requireAdmin, streetsController.createStreet);
router.put('/:id', verifyToken, requireAdmin, streetsController.updateStreet);
router.delete('/:id', verifyToken, requireAdmin, streetsController.deleteStreet);

module.exports = router;
