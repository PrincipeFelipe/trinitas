const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { verifyToken, requireAdmin } = require('../middlewares/auth');

router.get('/', verifyToken, requireAdmin, async (req, res, next) => {
    try {
        const [[notifStats]] = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered,
                SUM(CASE WHEN status = 'RETURNED' THEN 1 ELSE 0 END) as returned,
                SUM(CASE WHEN assigned_user_id IS NULL THEN 1 ELSE 0 END) as unassigned,
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending
            FROM Notifications
        `);

        const [[userStats]] = await pool.query(`
            SELECT 
                COUNT(*) as total_users,
                SUM(CASE WHEN role = 'REPARTIDOR' THEN 1 ELSE 0 END) as total_couriers
            FROM Users
        `);

        const [[streetStats]] = await pool.query(`
            SELECT COUNT(*) as total_streets FROM Streets
        `);

        res.json({
            success: true,
            data: {
                notifications: {
                    total: notifStats.total || 0,
                    delivered: notifStats.delivered || 0,
                    returned: notifStats.returned || 0,
                    pending: notifStats.pending || 0,
                    unassigned: notifStats.unassigned || 0
                },
                users: {
                    total: userStats.total_users || 0,
                    couriers: userStats.total_couriers || 0
                },
                streets: {
                    total: streetStats.total_streets || 0
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
