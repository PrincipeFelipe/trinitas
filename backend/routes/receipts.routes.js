const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const pool = require('../db/connection');
const { verifyToken } = require('../middlewares/auth');

router.get('/history', verifyToken, async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT id, recipient_name, full_address, status 
            FROM notifications 
            WHERE status IN ('DELIVERED', 'RETURNED')
            ORDER BY id DESC
        `);
        res.json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
});

router.get('/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const filePath = path.join(__dirname, '../../backend/uploads/receipts', `${id}.pdf`);

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ success: false, error: 'Acuse no encontrado o aún generándose' });
    }
});

module.exports = router;
