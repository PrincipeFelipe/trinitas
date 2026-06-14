const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyToken, requirePermission } = require('../middlewares/auth');
const notificationsController = require('../controllers/notifications.controller');

// Configure multer to store file in memory
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', verifyToken, requirePermission('upload'), upload.single('file'), notificationsController.uploadNotifications);
router.post('/extract-streets', verifyToken, requirePermission('upload'), upload.single('file'), notificationsController.extractStreetsOnly);
router.post('/assign-manual', verifyToken, requirePermission('upload'), notificationsController.assignManual);
router.post('/add-streets', verifyToken, requirePermission('upload'), notificationsController.addNewStreets);
router.post('/bulk-assign', verifyToken, requirePermission('upload'), notificationsController.bulkAssignByStreet);
router.get('/list', verifyToken, requirePermission('notifications'), notificationsController.listNotifications);
router.post('/bulk-archive', verifyToken, requirePermission('notifications'), notificationsController.bulkArchive);
router.put('/reassign', verifyToken, requirePermission('notifications'), notificationsController.reassignUser);
router.post('/reassign-all', verifyToken, requirePermission('notifications'), notificationsController.reassignAll);
router.get('/details/:id', verifyToken, requirePermission('notifications'), notificationsController.getNotificationDetails);
router.get('/generate-pdf/:id', verifyToken, requirePermission('notifications'), notificationsController.generatePdf);
router.post('/generate-bulk-pdf', verifyToken, requirePermission('notifications'), notificationsController.generateBulkPdf);
router.get('/upload-dates', verifyToken, requirePermission('reports'), notificationsController.getUploadDates);
router.get('/report/:date', verifyToken, requirePermission('reports'), notificationsController.getReportByDate);

module.exports = router;
