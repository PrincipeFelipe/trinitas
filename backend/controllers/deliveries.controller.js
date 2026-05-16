const pool = require('../db/connection');

const getMyRoute = async (req, res, next) => {
    try {
        const query = `
            SELECT n.*, 
                   (SELECT COUNT(*) FROM delivery_attempts da WHERE da.notification_id = n.id AND da.company = n.company) as attempt_count,
                   s.name as street_name
            FROM notifications n
            LEFT JOIN streets s ON n.street_id = s.id
            WHERE assigned_user_id = ? 
              AND status NOT IN ('ENTREGADA', 'DEVUELTA')
        `;
        const [rows] = await pool.query(query, [req.user.id]);
        
        // Add informative fields for frontend
        const routeData = rows.map(r => ({
            ...r,
            current_attempt_number: r.attempt_count + 1
        }));

        res.json({ success: true, data: routeData });
    } catch (error) {
        next(error);
    }
};

const recordAttempt = async (req, res, next) => {
    try {
        const { notification_id } = req.params;
        const { status_result, receiver_name, receiver_dni, signature_base64, notes, company } = req.body;
        const user_id = req.user.id;

        if (!status_result || !company) {
            return res.status(400).json({ success: false, error: 'status_result and company are required' });
        }

        // Count previous attempts
        const [attRows] = await pool.query('SELECT COUNT(*) as count FROM delivery_attempts WHERE notification_id = ? AND company = ?', [notification_id, company]);
        let attemptCount = attRows[0].count;
        
        if (attemptCount >= 2) {
            return res.status(400).json({ success: false, error: 'Maximum attempts reached for this notification.' });
        }

        const newAttemptNumber = attemptCount + 1;

        const insertValues = [notification_id, company, newAttemptNumber, status_result, receiver_name || null, receiver_dni || null, signature_base64 || null, user_id, notes || null];
        console.log('Inserting into delivery_attempts:', insertValues);

        // Insert Attempt Log
        await pool.query(`
            INSERT INTO delivery_attempts (notification_id, company, attempt_number, status_result, receiver_name, receiver_dni, signature_base64, delivered_by, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, insertValues);

        // Determine new Notification Status
        let newNotificationStatus = 'PENDIENTE';
        if (status_result === 'ENTREGADA') {
            newNotificationStatus = 'ENTREGADA';
        } else {
            // Failed attempt logic
            if (newAttemptNumber === 1) {
                newNotificationStatus = '1ER_INTENTO';
            } else if (newAttemptNumber === 2) {
                newNotificationStatus = 'DEVUELTA';
            }
        }

        // Update Notification table
        await pool.query('UPDATE notifications SET status = ? WHERE id = ? AND company = ?', [newNotificationStatus, notification_id, company]);

        // Trigger PDF Compilation if finalized
        if (newNotificationStatus === 'ENTREGADA' || newNotificationStatus === 'DEVUELTA') {
            const { generateReceiptPDF } = require('../utils/pdfGenerator');
            generateReceiptPDF(notification_id, company).catch(err => console.error(err));
        }

        res.json({ success: true, message: 'Attempt registered', new_status: newNotificationStatus });
    } catch (error) {
        next(error);
    }
};

module.exports = { getMyRoute, recordAttempt };
