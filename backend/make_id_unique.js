require('dotenv').config();
const pool = require('./db/connection');

async function migrateUniqueId() {
    try {
        console.log("Iniciando migración para hacer ID de notificación único...");
        await pool.query("SET FOREIGN_KEY_CHECKS = 0;");

        // 1. Eliminar duplicados en 'notifications' (dejamos solo 1 fila por ID)
        console.log("Eliminando notificaciones duplicadas con mismo ID...");
        await pool.query(`
            DELETE n FROM notifications n
            JOIN (
                SELECT id, MIN(company) as keep_company 
                FROM notifications 
                GROUP BY id 
                HAVING COUNT(*) > 1
            ) dup ON n.id = dup.id AND n.company != dup.keep_company
        `);

        // 2. Eliminar intentos de entrega que ya no tienen notificación
        console.log("Limpiando intentos huérfanos...");
        await pool.query(`
            DELETE FROM delivery_attempts 
            WHERE notification_id NOT IN (SELECT id FROM notifications)
        `);

        // 3. Modificar Primary Key en 'notifications'
        console.log("Modificando Primary Key de notifications...");
        await pool.query("ALTER TABLE notifications DROP PRIMARY KEY, ADD PRIMARY KEY (id)");

        // 4. Modificar constraints en 'delivery_attempts'
        console.log("Actualizando claves foráneas en delivery_attempts...");
        
        try { await pool.query("ALTER TABLE delivery_attempts DROP FOREIGN KEY delivery_attempts_ibfk_1"); } catch(e) {}
        try { await pool.query("ALTER TABLE delivery_attempts DROP INDEX delivery_attempts_ibfk_1"); } catch(e) {}
        
        // Modificar UNIQUE KEY previa si existe
        try { await pool.query("ALTER TABLE delivery_attempts DROP INDEX unq_notification_attempt"); } catch(e) {}
        
        // Eliminar intentos duplicados (dejamos solo 1 fila por ID y número de intento)
        console.log("Eliminando intentos de entrega duplicados...");
        await pool.query(`
            DELETE da FROM delivery_attempts da
            JOIN (
                SELECT MIN(id) as id_to_keep, notification_id, attempt_number
                FROM delivery_attempts
                GROUP BY notification_id, attempt_number
                HAVING COUNT(*) > 1
            ) as t ON da.notification_id = t.notification_id AND da.attempt_number = t.attempt_number
            WHERE da.id != t.id_to_keep
        `);

        // Crear nuevas constraints
        await pool.query(`
            ALTER TABLE delivery_attempts 
            ADD CONSTRAINT delivery_attempts_ibfk_1 
            FOREIGN KEY (notification_id) REFERENCES notifications (id) ON DELETE CASCADE
        `);

        await pool.query(`
            ALTER TABLE delivery_attempts 
            ADD UNIQUE INDEX unq_notification_attempt (notification_id, attempt_number)
        `);

        await pool.query("SET FOREIGN_KEY_CHECKS = 1;");
        console.log("Migración completada exitosamente.");
    } catch (e) {
        console.error("Error en migración:", e);
    } finally {
        process.exit(0);
    }
}

migrateUniqueId();
