const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const pool = require('../db/connection');
const { verifyToken, requirePermission } = require('../middlewares/auth');

router.get('/history', verifyToken, requirePermission('receipts'), async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT id, id_notificacion, recipient_name, full_address, status, company
            FROM notifications 
            WHERE status IN ('ENTREGADA', 'DEVUELTA')
            ORDER BY id DESC
        `);
        res.json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
});

router.get('/:id', verifyToken, requirePermission('receipts'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { company } = req.query;

        if (!company) {
            return res.status(400).json({ success: false, error: 'Missing company parameter' });
        }

        const [rows] = await pool.query('SELECT id_notificacion FROM notifications WHERE id = ? AND company = ?', [id, company]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Notificación no encontrada' });
        }
        
        const id_notificacion = rows[0].id_notificacion;
        const { generateReceiptPDF } = require('../utils/pdfGenerator');
        const filePath = await generateReceiptPDF(id, company);

        if (filePath && fs.existsSync(filePath)) {
            res.download(filePath, `${id_notificacion}.pdf`);
        } else {
            res.status(404).json({ success: false, error: 'Acuse no encontrado o aún generándose' });
        }
    } catch (error) {
        next(error);
    }
});

module.exports = router;
