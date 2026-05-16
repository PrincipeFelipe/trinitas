require('dotenv').config();
const pool = require('./db/connection');

async function fixStatuses() {
    try {
        console.log("Recalculando estados...");
        const [result] = await pool.query(`
            UPDATE notifications n 
            JOIN (
                SELECT notification_id, company, 
                       MAX(attempt_number) as max_att, 
                       SUM(CASE WHEN status_result='ENTREGADA' THEN 1 ELSE 0 END) as has_delivered 
                FROM delivery_attempts 
                GROUP BY notification_id, company
            ) a ON n.id = a.notification_id AND n.company = a.company 
            SET n.status = CASE 
                WHEN a.has_delivered > 0 THEN 'ENTREGADA' 
                WHEN a.max_att = 1 THEN '1ER_INTENTO' 
                WHEN a.max_att >= 2 THEN 'DEVUELTA' 
                ELSE 'PENDIENTE' 
            END
            WHERE n.status = 'PENDIENTE'
        `);
        console.log(`Actualizadas ${result.affectedRows} notificaciones.`);
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
fixStatuses();
