const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { verifyToken, requireAdmin } = require('../middlewares/auth');

router.get('/', verifyToken, requireAdmin, async (req, res, next) => {
    try {
        const { startDate, endDate, company } = req.query;

        // --- Notifications Stats ---
        let notifWhere = 'WHERE 1=1';
        let notifParams = [];
        if (company) {
            notifWhere += ' AND company = ?';
            notifParams.push(company);
        }
        if (startDate) {
            notifWhere += ' AND created_at >= ?';
            notifParams.push(startDate + ' 00:00:00');
        }
        if (endDate) {
            notifWhere += ' AND created_at <= ?';
            notifParams.push(endDate + ' 23:59:59');
        }

        const [[notifStats]] = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'ENTREGADA' THEN 1 ELSE 0 END) as delivered,
                SUM(CASE WHEN status = 'DEVUELTA' THEN 1 ELSE 0 END) as returned,
                SUM(CASE WHEN assigned_user_id IS NULL THEN 1 ELSE 0 END) as unassigned_count,
                SUM(CASE WHEN status = 'PENDIENTE' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = '1ER_INTENTO' THEN 1 ELSE 0 END) as attempt1
            FROM notifications
            ${notifWhere}
        `, notifParams);

        // --- User Stats (general count, not filtered by default) ---
        const [[userStats]] = await pool.query(`
            SELECT 
                COUNT(*) as total_users,
                SUM(CASE WHEN role = 'REPARTIDOR' THEN 1 ELSE 0 END) as total_couriers
            FROM users
        `);

        // Active couriers under filters
        const [[activeCourierStats]] = await pool.query(`
            SELECT COUNT(DISTINCT assigned_user_id) as active_couriers
            FROM notifications
            ${notifWhere} AND assigned_user_id IS NOT NULL
        `, notifParams);

        // --- Street Stats (general count) ---
        const [[streetStats]] = await pool.query(`
            SELECT 
                COUNT(*) as total_streets,
                (SELECT COUNT(*) FROM demarcations) as assigned_streets
            FROM streets
        `);

        // Active streets under filters
        const [[activeStreetStats]] = await pool.query(`
            SELECT COUNT(DISTINCT street_id) as active_streets
            FROM notifications
            ${notifWhere} AND street_id IS NOT NULL
        `, notifParams);

        // --- Calendar: deliveries and attempts per day ---
        let calWhere = 'WHERE 1=1';
        let calParams = [];
        if (company) {
            calWhere += ' AND company = ?';
            calParams.push(company);
        }
        if (startDate) {
            calWhere += ' AND timestamp >= ?';
            calParams.push(startDate + ' 00:00:00');
        } else {
            calWhere += ' AND timestamp >= DATE_SUB(NOW(), INTERVAL 90 DAY)';
        }
        if (endDate) {
            calWhere += ' AND timestamp <= ?';
            calParams.push(endDate + ' 23:59:59');
        }

        const [calendarDeliveries] = await pool.query(`
            SELECT 
                DATE_FORMAT(timestamp, '%Y-%m-%d') as day,
                COUNT(*) as attempts,
                SUM(CASE WHEN status_result = 'ENTREGADA' THEN 1 ELSE 0 END) as delivered
            FROM delivery_attempts
            ${calWhere}
            GROUP BY day
            ORDER BY day ASC
        `, calParams);

        // --- Unassigned notifications detail ---
        let unassignedWhere = "WHERE assigned_user_id IS NULL AND status NOT IN ('ENTREGADA', 'DEVUELTA')";
        let unassignedParams = [];
        if (company) {
            unassignedWhere += ' AND company = ?';
            unassignedParams.push(company);
        }
        if (startDate) {
            unassignedWhere += ' AND created_at >= ?';
            unassignedParams.push(startDate + ' 00:00:00');
        }
        if (endDate) {
            unassignedWhere += ' AND created_at <= ?';
            unassignedParams.push(endDate + ' 23:59:59');
        }

        const [unassignedNotifs] = await pool.query(`
            SELECT id, recipient_name, full_address, created_at
            FROM notifications
            ${unassignedWhere}
            ORDER BY created_at ASC
            LIMIT 20
        `, unassignedParams);

        // --- Per-courier effectiveness ---
        let courierJoinOn = 'ON n.assigned_user_id = u.id';
        let courierParams = [];
        if (company) {
            courierJoinOn += ' AND n.company = ?';
            courierParams.push(company);
        }
        if (startDate) {
            courierJoinOn += ' AND n.created_at >= ?';
            courierParams.push(startDate + ' 00:00:00');
        }
        if (endDate) {
            courierJoinOn += ' AND n.created_at <= ?';
            courierParams.push(endDate + ' 23:59:59');
        }

        const [courierStats] = await pool.query(`
            SELECT 
                u.name,
                COUNT(DISTINCT n.id) as total_assigned,
                SUM(CASE WHEN n.status = 'ENTREGADA' THEN 1 ELSE 0 END) as delivered,
                SUM(CASE WHEN n.status = 'DEVUELTA' THEN 1 ELSE 0 END) as returned
            FROM users u
            LEFT JOIN notifications n ${courierJoinOn}
            WHERE u.role = 'REPARTIDOR'
            GROUP BY u.id, u.name
        `, courierParams);

        // --- Urgency breakdown ---
        let urgencyWhere = "WHERE status NOT IN ('ENTREGADA', 'DEVUELTA')";
        let urgencyParams = [];
        if (company) {
            urgencyWhere += ' AND company = ?';
            urgencyParams.push(company);
        }
        if (startDate) {
            urgencyWhere += ' AND created_at >= ?';
            urgencyParams.push(startDate + ' 00:00:00');
        }
        if (endDate) {
            urgencyWhere += ' AND created_at <= ?';
            urgencyParams.push(endDate + ' 23:59:59');
        }

        const [urgencyStats] = await pool.query(`
            SELECT 
                SUM(CASE WHEN DATEDIFF(NOW(), created_at) BETWEEN 0 AND 2 THEN 1 ELSE 0 END) as safe,
                SUM(CASE WHEN DATEDIFF(NOW(), created_at) BETWEEN 3 AND 4 THEN 1 ELSE 0 END) as warning,
                SUM(CASE WHEN DATEDIFF(NOW(), created_at) >= 5 THEN 1 ELSE 0 END) as critical
            FROM notifications
            ${urgencyWhere}
        `, urgencyParams);

        res.json({
            success: true,
            data: {
                notifications: {
                    total: notifStats.total || 0,
                    delivered: notifStats.delivered || 0,
                    returned: notifStats.returned || 0,
                    pending: notifStats.pending || 0,
                    attempt1: notifStats.attempt1 || 0,
                    unassigned: notifStats.unassigned_count || 0,
                    deliveryRate: notifStats.total > 0 
                        ? Math.round((notifStats.delivered / notifStats.total) * 100) 
                        : 0
                },
                users: {
                    total: userStats.total_users || 0,
                    couriers: userStats.total_couriers || 0,
                    active: activeCourierStats.active_couriers || 0
                },
                streets: {
                    total: streetStats.total_streets || 0,
                    assigned: streetStats.assigned_streets || 0,
                    active: activeStreetStats.active_streets || 0
                },
                calendar: calendarDeliveries,
                unassignedNotifs,
                courierStats,
                urgency: urgencyStats[0] || { safe: 0, warning: 0, critical: 0 }
            }
        });
    } catch (error) {
        next(error);
    }
});

router.get('/activity/:date', verifyToken, requireAdmin, async (req, res, next) => {
    try {
        const { date } = req.params;
        const [rows] = await pool.query(`
            SELECT 
                da.id as attempt_id,
                da.timestamp,
                da.status_result,
                da.notes,
                n.id as notification_id,
                n.id_notificacion,
                n.recipient_name,
                n.full_address,
                n.company,
                u.name as courier_name
            FROM delivery_attempts da
            JOIN notifications n ON da.notification_id = n.id
            LEFT JOIN users u ON da.delivered_by = u.id
            WHERE DATE(da.timestamp) = ?
            ORDER BY da.timestamp DESC
        `, [date]);

        res.json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
