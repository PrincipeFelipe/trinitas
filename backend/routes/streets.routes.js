const express = require('express');
const router = express.Router();
const streetsController = require('../controllers/streets.controller');
const { verifyToken, requirePermission } = require('../middlewares/auth');

router.get('/', verifyToken, streetsController.getAllStreets);
router.get('/:id', verifyToken, streetsController.getStreetById);
router.post('/', verifyToken, requirePermission('streets'), streetsController.createStreet);
router.put('/:id', verifyToken, requirePermission('streets'), streetsController.updateStreet);
router.delete('/:id', verifyToken, requirePermission('streets'), streetsController.deleteStreet);

module.exports = router;
