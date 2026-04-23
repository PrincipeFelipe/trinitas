const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyToken, requireAdmin } = require('../middlewares/auth');
const notificationsController = require('../controllers/notifications.controller');

// Configure multer to store file in memory
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', verifyToken, requireAdmin, upload.single('file'), notificationsController.uploadNotifications);
router.post('/extract-streets', verifyToken, requireAdmin, upload.single('file'), notificationsController.extractStreetsOnly);
router.post('/assign-manual', verifyToken, requireAdmin, notificationsController.assignManual);
router.post('/add-streets', verifyToken, requireAdmin, notificationsController.addNewStreets);
router.post('/bulk-assign', verifyToken, requireAdmin, notificationsController.bulkAssignByStreet);
router.get('/list', verifyToken, requireAdmin, notificationsController.listNotifications);
router.put('/reassign', verifyToken, requireAdmin, notificationsController.reassignUser);
router.post('/reassign-all', verifyToken, requireAdmin, notificationsController.reassignAll);
router.get('/details/:id', verifyToken, requireAdmin, notificationsController.getNotificationDetails);
router.get('/generate-pdf/:id', verifyToken, requireAdmin, notificationsController.generatePdf);

module.exports = router;
