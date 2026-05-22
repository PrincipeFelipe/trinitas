const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const pool = require('../db/connection');
const { verifyToken } = require('../middlewares/auth');

router.get('/history', verifyToken, async (req, res, next) => {
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

router.get('/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const { company } = req.query;

    if (!company) {
        return res.status(400).json({ success: false, error: 'Missing company parameter' });
    }

    const filePath = path.join(__dirname, '../../backend/uploads/receipts', `${id}-${company}.pdf`);

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ success: false, error: 'Acuse no encontrado o aún generándose' });
    }
});

module.exports = router;
